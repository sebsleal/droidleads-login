"""
Florida Voter Registration contact enrichment.

Florida's voter registration records are public and include:
  - Full name, address, phone number, email (where provided), party, DOB

How to obtain FL voter roll data:
  1. Submit a public records request to the Florida Division of Elections:
     https://dos.fl.gov/elections/data-statistics/voter-registration-statistics/
  2. Or request county-level files from Miami-Dade SOE:
     https://www.miamidadecounty.gov/government/departments/elections/
  3. Format: CSV with columns including Name, ResidenceAddress, Phone, Email

Once downloaded, place the file at: data/voter_rolls.csv
The enrichment function will automatically use it.

Typical hit rate: ~65-75% of FL homeowners are registered voters.
"""

import csv
import os
import re
from typing import Any

from scrapers.sunbiz import is_business_entity

VOTER_ROLL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "voter_rolls.csv")
NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def _normalize_header(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.lower())


def _get_row_value(row: dict[str, str], *candidate_headers: str) -> str:
    if not row:
        return ""

    normalized_row = {
        _normalize_header(key): (value or "")
        for key, value in row.items()
        if key is not None
    }
    for header in candidate_headers:
        value = normalized_row.get(_normalize_header(header), "")
        if value:
            return value.strip()
    return ""


def _voter_name(row: dict[str, str]) -> str:
    full_name = _get_row_value(
        row,
        "Name",
        "FullName",
        "Full Name",
        "NAMEFULL",
    )
    if full_name:
        return full_name

    first_name = _get_row_value(row, "FirstName", "First Name", "NAMEFIRST")
    middle_name = _get_row_value(row, "MiddleName", "Middle Name", "NAMEMIDDLE")
    last_name = _get_row_value(row, "LastName", "Last Name", "NAMELAST")
    suffix = _get_row_value(row, "NameSuffix", "Name Suffix", "NAMESUFFIX")

    parts = [part for part in [first_name, middle_name, last_name, suffix] if part]
    return " ".join(parts)


def _voter_address(row: dict[str, str]) -> str:
    return _get_row_value(
        row,
        "ResidenceAddress",
        "Residence Address",
        "ResidenceAddressLine1",
        "Residence Address Line 1",
        "RESADDR",
        "address",
    )


def _voter_phone(row: dict[str, str]) -> str:
    return _get_row_value(
        row,
        "Phone",
        "PhoneNumber",
        "PHONENUMBER",
    )


def _voter_email(row: dict[str, str]) -> str:
    return _get_row_value(
        row,
        "Email",
        "EmailAddress",
        "EMAILADDRESS",
    )


def normalize_name(name: str) -> str:
    """Normalize name for fuzzy matching: lowercase, remove punctuation."""
    return re.sub(r"[^a-z ]", "", name.lower().strip())


def _ordered_name_tokens(name: str) -> list[str]:
    return [
        token
        for token in normalize_name(name).split()
        if token and token not in NAME_SUFFIXES and len(token) > 1
    ]


def _name_tokens(name: str) -> set[str]:
    return set(_ordered_name_tokens(name))


def _name_parts(name: str) -> tuple[str, str]:
    if not name:
        return "", ""

    if "," in name:
        last_raw, first_raw = name.split(",", 1)
        last_tokens = _ordered_name_tokens(last_raw)
        first_tokens = _ordered_name_tokens(first_raw)
        return (
            first_tokens[0] if first_tokens else "",
            last_tokens[-1] if last_tokens else "",
        )

    tokens = _ordered_name_tokens(name)
    if not tokens:
        return "", ""
    if len(tokens) == 1:
        return tokens[0], tokens[0]
    return tokens[0], tokens[-1]


def _last_name_token(name: str) -> str:
    return _name_parts(name)[1]


def normalize_address(address: str) -> str:
    """Normalize address for matching: lowercase, strip unit numbers and punctuation."""
    addr = address.lower().strip()
    addr = re.sub(r"[.,]", " ", addr)
    addr = re.sub(r"\b(apt|unit|suite|ste|#)\s*\w+", "", addr)
    addr = re.sub(r"\bnorthwest\b", "nw", addr)
    addr = re.sub(r"\bnortheast\b", "ne", addr)
    addr = re.sub(r"\bsouthwest\b", "sw", addr)
    addr = re.sub(r"\bsoutheast\b", "se", addr)
    return re.sub(r"\s+", " ", addr).strip()


def load_voter_roll() -> list[dict[str, str]]:
    """Load voter roll CSV/TSV into memory. Returns empty list if file not found."""
    if not os.path.exists(VOTER_ROLL_PATH):
        return []
    try:
        with open(VOTER_ROLL_PATH, encoding="utf-8", errors="replace", newline="") as f:
            first_line = f.readline()
            delimiter = "\t" if "\t" in first_line else ","
            f.seek(0)
            reader = csv.DictReader(f, delimiter=delimiter)
            return list(reader)
    except Exception as e:
        print(f"[voter] Could not load voter roll: {e}")
        return []


def build_voter_index(voter_roll: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    """
    Build a lookup index keyed by normalized (last_name, street_number).
    This narrows down likely candidates before full name+address comparison.
    """
    index: dict[str, list[dict[str, str]]] = {}
    for row in voter_roll:
        name = _voter_name(row)
        address = _voter_address(row)

        name_tokens = _name_tokens(name)
        street_num_match = re.match(r"(\d+)", normalize_address(address))
        street_num = street_num_match.group(1) if street_num_match else ""

        last_name = _last_name_token(name)
        if last_name and street_num:
            key = f"{last_name}|{street_num}"
            index.setdefault(key, []).append(row)

    return index


def match_voter(
    lead: dict[str, Any],
    voter_index: dict[str, list[dict[str, str]]],
) -> dict[str, str | None] | None:
    """
    Attempt to match a lead to a voter record.
    Returns dict with 'phone' and/or 'email' if matched, else None.
    """
    owner = lead.get("owner_name") or lead.get("ownerName") or ""
    address = lead.get("address") or lead.get("propertyAddress") or ""

    owner_tokens = _name_tokens(owner)
    owner_name_parts = _ordered_name_tokens(owner)
    owner_first_name, owner_last_name = _name_parts(owner)
    normalized_address = normalize_address(address)
    street_num_match = re.match(r"(\d+)", normalized_address)
    street_num = street_num_match.group(1) if street_num_match else ""

    if not owner_tokens or not owner_last_name or not street_num or not normalized_address:
        return None

    key = f"{owner_last_name}|{street_num}"
    candidates = voter_index.get(key, [])

    for candidate in candidates:
        candidate_first_name, candidate_last_name = _name_parts(_voter_name(candidate))
        candidate_address = normalize_address(_voter_address(candidate))
        if candidate_last_name != owner_last_name or candidate_address != normalized_address:
            continue
        if len(owner_name_parts) > 1 and owner_first_name and candidate_first_name != owner_first_name:
            continue

        phone = _voter_phone(candidate)
        email = _voter_email(candidate)

        if phone or email:
            return {
                "phone": phone if phone else None,
                "email": email if email else None,
                "source": "voter_roll",
            }

    return None


def enrich_with_voter_data(
    leads: list[dict[str, Any]],
    top_n: int = 100,
) -> list[dict[str, Any]]:
    """
    Enrich leads with contact info from FL voter roll data.

    Only processes leads with no existing contact info.
    Requires data/voter_rolls.csv to be present.

    Args:
        leads: List of lead dicts, sorted by score descending.
        top_n: Max number of leads to attempt voter matching on.

    Returns:
        List of lead dicts with contact info populated where matched.
    """
    voter_roll = load_voter_roll()
    if not voter_roll:
        print("[voter] No voter roll data found. Skipping voter enrichment.")
        print("[voter] To enable: place FL voter roll CSV at data/voter_rolls.csv")
        return leads

    print(f"[voter] Loaded {len(voter_roll):,} voter records. Building index...")
    voter_index = build_voter_index(voter_roll)
    print(f"[voter] Index built with {len(voter_index):,} keys.")

    enriched = 0
    for i, lead in enumerate(leads[:top_n]):
        owner = lead.get("owner_name") or lead.get("ownerName") or ""
        if owner and is_business_entity(owner):
            continue

        existing_phone = lead.get("contact_phone") or (lead.get("contact") or {}).get("phone")
        existing_email = lead.get("contact_email") or (lead.get("contact") or {}).get("email")
        if existing_phone and existing_email:
            continue

        match = match_voter(lead, voter_index)
        if match:
            phone = existing_phone or match.get("phone")
            email = existing_email or match.get("email")

            # Populate missing contact fields only
            if not existing_phone and match.get("phone"):
                lead["contact_phone"] = match.get("phone")
            if not existing_email and match.get("email"):
                lead["contact_email"] = match.get("email")

            if "contact" in lead or phone or email:
                lead["contact"] = {
                    "phone": phone,
                    "email": email,
                }
            enriched += 1

    print(f"[voter] Voter enrichment complete: {enriched} leads enriched")
    return leads


if __name__ == "__main__":
    # Test with a sample lead
    test_leads = [
        {
            "owner_name": "Rodriguez",
            "address": "1427 SW 8th St",
            "contact_phone": None,
            "contact_email": None,
        }
    ]
    result = enrich_with_voter_data(test_leads)
    for lead in result:
        print(f"Contact: {lead.get('contact_phone')} / {lead.get('contact_email')}")
