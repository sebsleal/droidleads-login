"""
import_cases.py — One-time CRM import script for Claim Remedy Adjusters.

Reads the exported CRM spreadsheet (CSV or xlsx) and upserts all client
case records into the Supabase `cases` table.

Usage:
    python db/import_cases.py --file /path/to/claims.csv
    python db/import_cases.py --file /path/to/claims.xlsx

The script is idempotent: it upserts on `file_number` so re-running it
with an updated export will update existing rows without creating duplicates.

Expected CSV columns (case-insensitive, flexible matching):
    File #, Client Last Name, Client First Name, Loss Date, Peril,
    Insurance Company, Policy #, Claim #, Status, Fee Rate, Fee Disb. to Us,
    Estimated Loss, Date Logged, Mailing Address, Phones, Email
"""

import argparse
import csv
import os
import re
import sys
from datetime import date, datetime
from typing import Any

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

try:
    import openpyxl

    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


# ---------------------------------------------------------------------------
# Status normalisation — maps CRM status strings to DB enum values
# ---------------------------------------------------------------------------

VALID_STATUSES = {
    "Settled",
    "Litigation",
    "Appraisal",
    "Closed w/o Pay",
    "OpenPhase: Estimating",
    "OpenPhase: Inspection",
    "OpenPhase: Appraisal",
    "OpenPhase: Mortgage Processing",
    "OpenPhase: Negotiation",
    "OpenPhase: Mediation",
    "OpenPhase: Initial Payment",
    "OpenPhase: Under Review",
    "OpenPhase: Claim Originated",
    "OpenPhase: Recovering Depreciation",
    "OpenPhase: Ready to Close",
    "OpenPhase: Settled",
}

STATUS_ALIASES: dict[str, str] = {
    "settled": "Settled",
    "closed with payment": "Settled",
    "litigation": "Litigation",
    "open phase: litigation": "Litigation",
    "openphase: litigation": "Litigation",
    "appraisal": "Appraisal",
    "open phase: appraisal": "OpenPhase: Appraisal",
    "openphase: appraisal": "OpenPhase: Appraisal",
    "closed w/o pay": "Closed w/o Pay",
    "closed without pay": "Closed w/o Pay",
    "closed without payment": "Closed w/o Pay",
    "open phase: estimating": "OpenPhase: Estimating",
    "openphase: estimating": "OpenPhase: Estimating",
    "open phase: inspection": "OpenPhase: Inspection",
    "openphase: inspection": "OpenPhase: Inspection",
    "open phase: mortgage processing": "OpenPhase: Mortgage Processing",
    "openphase: mortgage processing": "OpenPhase: Mortgage Processing",
    "open phase: negotiation": "OpenPhase: Negotiation",
    "openphase: negotiation": "OpenPhase: Negotiation",
    "open phase: mediation": "OpenPhase: Mediation",
    "openphase: mediation": "OpenPhase: Mediation",
    "open phase: initial payment": "OpenPhase: Initial Payment",
    "openphase: initial payment": "OpenPhase: Initial Payment",
    "open phase: under review": "OpenPhase: Under Review",
    "openphase: under review": "OpenPhase: Under Review",
    "open phase: claim originated": "OpenPhase: Claim Originated",
    "openphase: claim originated": "OpenPhase: Claim Originated",
    "open phase: recovering depreciation": "OpenPhase: Recovering Depreciation",
    "openphase: recovering depreciation": "OpenPhase: Recovering Depreciation",
    "open phase: ready to close": "OpenPhase: Ready to Close",
    "openphase: ready to close": "OpenPhase: Ready to Close",
    "open phase: settled": "OpenPhase: Settled",
    "openphase: settled": "OpenPhase: Settled",
}


def normalise_status(raw: str) -> str:
    if not raw:
        return "OpenPhase: Claim Originated"
    cleaned = raw.strip()
    if cleaned in VALID_STATUSES:
        return cleaned
    lower = cleaned.lower()
    if lower in STATUS_ALIASES:
        return STATUS_ALIASES[lower]
    # Fuzzy: if it contains 'litigation' → Litigation, etc.
    if "litigation" in lower:
        return "Litigation"
    if "settled" in lower:
        return "Settled"
    if "appraisal" in lower:
        return "OpenPhase: Appraisal"
    if "mediation" in lower:
        return "OpenPhase: Mediation"
    if "mortgage" in lower:
        return "OpenPhase: Mortgage Processing"
    if "estimat" in lower:
        return "OpenPhase: Estimating"
    if "inspect" in lower:
        return "OpenPhase: Inspection"
    if "negotiat" in lower:
        return "OpenPhase: Negotiation"
    if "initial payment" in lower:
        return "OpenPhase: Initial Payment"
    if "under review" in lower:
        return "OpenPhase: Under Review"
    if "closed" in lower and ("pay" in lower or "no pay" in lower):
        return "Closed w/o Pay"
    return "OpenPhase: Claim Originated"


# ---------------------------------------------------------------------------
# Field parsers
# ---------------------------------------------------------------------------


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if not s or s in ("-", "n/a", "none", "N/A"):
        return None
    # Try common formats
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%m-%d-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_fee_rate(value: Any) -> float | None:
    if not value:
        return None
    s = str(value).strip().replace("%", "").strip()
    if not s:
        return None
    try:
        pct = float(s)
        # If given as whole number (e.g. "20"), convert to decimal
        if pct > 1:
            pct = pct / 100
        return round(pct, 4)
    except ValueError:
        return None


def parse_currency(value: Any) -> float | None:
    if not value:
        return None
    s = str(value).strip().replace("$", "").replace(",", "").strip()
    if not s or s in ("-", "n/a", "none"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalise_col(name: str) -> str:
    """Normalise column header for flexible matching."""
    return re.sub(r"[^a-z0-9]", "", name.lower().strip())


# ---------------------------------------------------------------------------
# Column name mappings (normalised → field)
# ---------------------------------------------------------------------------

COL_MAP: dict[str, str] = {
    "file": "file_number",
    "fileno": "file_number",
    "filenumber": "file_number",
    "clientlastname": "last_name",
    "clientfirstname": "first_name",
    "lastname": "last_name",
    "firstname": "first_name",
    "clientname": "client_name",
    "lossdate": "loss_date",
    "loss": "loss_date",
    "peril": "peril_type",
    "periltype": "peril_type",
    "typeofclaim": "peril_type",
    "claim": "peril_type",
    "insurancecompany": "insurance_company",
    "insurer": "insurance_company",
    "insurance": "insurance_company",
    "policyno": "policy_number",
    "policy": "policy_number",
    "policynumber": "policy_number",
    "claimno": "claim_number",
    "claimnumber": "claim_number",
    "status": "status_phase",
    "feerate": "fee_rate",
    "fee": "fee_rate",
    "feedisbtonus": "fee_disbursed",
    "feedisb": "fee_disbursed",
    "feedisburse": "fee_disbursed",
    "estimatedloss": "estimated_loss",
    "estimatedvalue": "estimated_loss",
    "datelogged": "date_logged",
    "logged": "date_logged",
    "mailingaddress": "mailing_address",
    "mailing": "mailing_address",
    "address": "mailing_address",
    "phones": "phone",
    "phone": "phone",
    "email": "email",
    "lossaddress": "loss_address",
    "propertyaddress": "loss_address",
    "property": "loss_address",
}


def map_row(headers: list[str], row: dict) -> dict:
    """Map a raw CSV/xlsx row to a cases DB record."""
    mapped: dict[str, Any] = {}

    for col, value in row.items():
        key = normalise_col(col)
        field = COL_MAP.get(key)
        if field and value is not None and str(value).strip():
            mapped[field] = str(value).strip()

    # Build client_name from first + last if not already present
    if "client_name" not in mapped:
        first = mapped.pop("first_name", "") or ""
        last = mapped.pop("last_name", "") or ""
        name = f"{first} {last}".strip()
        if name:
            mapped["client_name"] = name

    # Require file_number
    if not mapped.get("file_number"):
        return {}

    # Require client_name
    if not mapped.get("client_name"):
        mapped["client_name"] = "Unknown"

    # Require loss_address (fall back to mailing_address)
    if not mapped.get("loss_address"):
        mapped["loss_address"] = mapped.get("mailing_address", "Unknown")

    # Parse typed fields
    mapped["loss_date"] = parse_date(mapped.get("loss_date"))
    mapped["date_logged"] = parse_date(
        mapped.get("date_logged")
    ) or date.today().strftime("%Y-%m-%d")
    mapped["fee_rate"] = parse_fee_rate(mapped.get("fee_rate"))
    mapped["fee_disbursed"] = parse_currency(mapped.get("fee_disbursed"))
    mapped["estimated_loss"] = parse_currency(mapped.get("estimated_loss"))
    mapped["status_phase"] = normalise_status(mapped.get("status_phase", ""))

    # Remove None values so Supabase upsert doesn't overwrite with null
    return {k: v for k, v in mapped.items() if v is not None}


# ---------------------------------------------------------------------------
# File readers
# ---------------------------------------------------------------------------


def read_csv(filepath: str) -> list[dict]:
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def read_xlsx(filepath: str) -> list[dict]:
    if not HAS_OPENPYXL:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl")
        sys.exit(1)
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h or "").strip() for h in rows[0]]
    result = []
    for row in rows[1:]:
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        result.append(dict(zip(headers, row)))
    return result


# ---------------------------------------------------------------------------
# Main import logic
# ---------------------------------------------------------------------------


def import_cases(filepath: str, dry_run: bool = False) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print(
            "ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
        )
        sys.exit(1)

    # Read file
    if filepath.endswith(".xlsx") or filepath.endswith(".xls"):
        raw_rows = read_xlsx(filepath)
    else:
        raw_rows = read_csv(filepath)

    print(f"Read {len(raw_rows)} rows from {filepath}")

    # Map rows
    records = []
    skipped = 0
    for raw in raw_rows:
        record = map_row(list(raw.keys()), raw)
        if not record:
            skipped += 1
            continue
        records.append(record)

    print(
        f"Mapped {len(records)} valid records ({skipped} skipped — missing file_number)"
    )

    if dry_run:
        print("\nDRY RUN — first 3 records:")
        for r in records[:3]:
            print(r)
        return

    # Upsert to Supabase
    client = create_client(url, key)
    batch_size = 50
    total_upserted = 0

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        result = (
            client.table("cases").upsert(batch, on_conflict="file_number").execute()
        )
        total_upserted += len(batch)
        print(f"  Upserted rows {i + 1}–{i + len(batch)}")

    print(f"\nDone. {total_upserted} cases upserted into Supabase.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import CRM cases into Supabase")
    parser.add_argument("--file", required=True, help="Path to CSV or XLSX file")
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse only, don't write to Supabase"
    )
    args = parser.parse_args()

    import_cases(args.file, dry_run=args.dry_run)
