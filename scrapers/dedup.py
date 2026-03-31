"""
Deduplication helper for leads.

Uses MD5 hash of (address + permit_date) as the dedup key.
Supports both in-memory dedup (for a single scrape run) and
persistent dedup against a set of already-seen hashes from the database.

Address normalization:
- Street suffixes are canonicalized: St→Street, Ave→Avenue, Blvd→Boulevard,
  Dr→Drive, Ln→Lane, Ct→Court, Rd→Road
- Directionals (NW/NE/SW/SE) are uppercased and have spaces normalized
- Normalization is case-insensitive and idempotent.
"""

import re
import hashlib
from typing import Any

# Suffix replacements — order matters (longer forms first to avoid partial replacement)
_SUFFIX_REPLACEMENTS: list[tuple[str, str]] = [
    ("Street", "Street"),
    ("St", "Street"),
    ("Avenue", "Avenue"),
    ("Ave", "Avenue"),
    ("Boulevard", "Boulevard"),
    ("Blvd", "Boulevard"),
    ("Drive", "Drive"),
    ("Dr", "Drive"),
    ("Lane", "Lane"),
    ("Ln", "Lane"),
    ("Court", "Court"),
    ("Ct", "Court"),
    ("Road", "Road"),
    ("Rd", "Road"),
]

# Regex for directional prefix/suffix (NW, NE, SW, SE with optional comma/dot separators)
_DIRECTIONAL_RE = re.compile(
    r"\b(NW|NE|SW|SE)\b",
    re.IGNORECASE,
)


def normalize_address(address: str) -> str:
    """
    Canonicalize a street address for consistent hashing.

    Replaces common abbreviations with their full forms (St→Street, Ave→Avenue,
    Blvd→Boulevard, Dr→Drive, Ln→Lane, Ct→Court, Rd→Road), uppercases directionals
    (NW/NE/SW/SE), strips leading/trailing whitespace, and lowercases the result.

    Normalization is idempotent: calling it multiple times yields the same result.

    Args:
        address: Raw address string.

    Returns:
        Canonical lowercase address string.
    """
    addr = address.lower().strip()

    # Uppercase directionals for consistency (nw → NW)
    addr = _DIRECTIONAL_RE.sub(lambda m: m.group(0).upper(), addr)

    # Replace suffix abbreviations with full forms (case-insensitive via regex)
    for abbrev, full in _SUFFIX_REPLACEMENTS:
        # Replace word-boundary abbrev with full form (case-insensitive)
        pattern = re.compile(r"\b" + re.escape(abbrev) + r"\b", re.IGNORECASE)
        addr = pattern.sub(full, addr)

    return addr


def make_hash(address: str, permit_date: str) -> str:
    """
    Generate a 12-character hex hash from address + permit_date.
    Case-insensitive; strips leading/trailing whitespace.
    Address is normalized before hashing so that abbreviated and
    full-form addresses produce the same hash.

    Args:
        address: Property street address string.
        permit_date: ISO date string (YYYY-MM-DD).

    Returns:
        12-character lowercase hex string.
    """
    key = f"{normalize_address(address)}|{permit_date.strip()}"
    return hashlib.md5(key.encode("utf-8")).hexdigest()[:12]


def deduplicate_leads(
    leads: list[dict[str, Any]],
    seen_hashes: set[str] | None = None,
) -> tuple[list[dict[str, Any]], set[str]]:
    """
    Remove duplicate leads within the batch and optionally against a set
    of already-known hashes (e.g. from database).

    Each lead dict must have 'address' and 'permit_date' keys.
    The function injects a 'dedup_hash' key into each surviving lead.

    Args:
        leads: List of lead dicts to deduplicate.
        seen_hashes: Optional set of hashes already in the database.
                     Leads whose hash is in this set are dropped.

    Returns:
        Tuple of (deduplicated_leads, updated_seen_hashes).
    """
    if seen_hashes is None:
        seen_hashes = set()

    result: list[dict[str, Any]] = []
    batch_seen: set[str] = set()
    duplicates = 0

    for lead in leads:
        address = lead.get("address") or lead.get("propertyAddress") or ""
        permit_date = lead.get("permit_date") or lead.get("permitDate") or ""

        h = make_hash(address, permit_date)

        if h in seen_hashes or h in batch_seen:
            duplicates += 1
            continue

        batch_seen.add(h)
        result.append({**lead, "dedup_hash": h})

    seen_hashes.update(batch_seen)

    print(
        f"[dedup] {len(leads)} leads in → {len(result)} unique, "
        f"{duplicates} duplicates removed"
    )
    return result, seen_hashes


def get_existing_hashes_from_db(supabase_client: Any) -> set[str]:
    """
    Fetch the set of dedup_hash values already stored in the database.
    Used to avoid re-inserting known leads.

    Args:
        supabase_client: An initialised supabase-py client.

    Returns:
        Set of hash strings.
    """
    try:
        response = (
            supabase_client.table("leads")
            .select("dedup_hash")
            .execute()
        )
        data = response.data or []
        return {row["dedup_hash"] for row in data if row.get("dedup_hash")}
    except Exception as e:
        print(f"[dedup] Could not fetch existing hashes from DB: {e}")
        return set()


if __name__ == "__main__":
    test_leads = [
        {"address": "1427 SW 8th St", "permit_date": "2026-03-10"},
        {"address": "1427 sw 8th st ", "permit_date": "2026-03-10"},  # duplicate
        {"address": "3812 NW 7th Ave", "permit_date": "2026-03-14"},
    ]

    unique, hashes = deduplicate_leads(test_leads)
    print(f"Unique leads: {len(unique)}")
    for lead in unique:
        print(lead)
