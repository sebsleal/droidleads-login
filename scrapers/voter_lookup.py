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


def normalize_name(name: str) -> str:
    """Normalize name for fuzzy matching: lowercase, remove punctuation."""
    return re.sub(r"[^a-z ]", "", name.lower().strip())


def normalize_address(address: str) -> str:
    """Normalize address for matching: lowercase, strip unit numbers and apt."""
    addr = address.lower().strip()
    # Remove apartment/unit designators
    addr = re.sub(r"\b(apt|unit|suite|ste|#)\s*\w+", "", addr)
    # Normalize directionals
    addr = addr.replace(" northwest ", " nw ").replace(" northeast ", " ne ")
    addr = addr.replace(" southwest ", " sw ").replace(" southeast ", " se ")
    return re.sub(r"\s+", " ", addr).strip()


def load_voter_roll() -> list[dict[str, str]]:
    """Load voter roll CSV into memory. Returns empty list if file not found."""
    if not os.path.exists(VOTER_ROLL_PATH):
        return []
    try:
        with open(VOTER_ROLL_PATH, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            return list(reader)
    except Exception as e:
        print(f"[voter] Could not load voter roll: {e}")
        return []


def build_voter_index(voter_roll: list[dict]) -> dict[str, list[dict]]:
    """
    Build a lookup index keyed by normalized (last_name, street_number).
    This allows fast fuzzy matching without scanning the full file.
    """
    index: dict[str, list[dict]] = {}
    for row in voter_roll:
        # Try common column name variants
        name = row.get("Name") or row.get("name") or row.get("NAMEFULL") or ""
        address = row.get("ResidenceAddress") or row.get("address") or row.get("RESADDR") or ""

        last_name = normalize_name(name).split()[-1] if name.strip() else ""
        # Extract street number from address
        street_num_match = re.match(r"(\d+)", normalize_address(address))
        street_num = street_num_match.group(1) if street_num_match else ""

        if last_name and street_num:
            key = f"{last_name}|{street_num}"
            index.setdefault(key, []).append(row)

    return index


def match_voter(
    lead: dict[str, Any],
    voter_index: dict[str, list[dict]],
) -> dict[str, str] | None:
    """
    Attempt to match a lead to a voter record.
    Returns dict with 'phone' and/or 'email' if matched, else None.
    """
    owner = lead.get("owner_name") or lead.get("ownerName") or ""
    address = lead.get("address") or lead.get("propertyAddress") or ""

    last_name = normalize_name(owner).split()[-1] if owner.strip() else ""
    street_num_match = re.match(r"(\d+)", normalize_address(address))
    street_num = street_num_match.group(1) if street_num_match else ""

    if not last_name or not street_num:
        return None

    key = f"{last_name}|{street_num}"
    candidates = voter_index.get(key, [])

    for candidate in candidates:
        phone = (
            candidate.get("Phone") or candidate.get("phone") or
            candidate.get("PHONENUMBER") or ""
        ).strip()
        email = (
            candidate.get("Email") or candidate.get("email") or
            candidate.get("EMAILADDRESS") or ""
        ).strip()

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
