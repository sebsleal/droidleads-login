"""
Miami-Dade Open Data permits scraper.
Fetches building permits filtered to damage-related types.
Public API — no key required.
"""

import requests
from typing import Any

MIAMI_DADE_API = "https://opendata.miamidade.gov/resource/hvj5-8dge.json"

DAMAGE_KEYWORDS = [
    "roof", "hurricane", "flood", "fire", "structural", "wind",
    "water damage", "storm", "damage", "repair", "restoration",
    "soffit", "shutter", "elevation", "mitigation", "rebuild",
    "foundation", "masonry", "wall repair", "window", "door replacement",
]


def is_damage_related(permit_type: str, work_desc: str) -> bool:
    text = f"{permit_type} {work_desc}".lower()
    return any(kw in text for kw in DAMAGE_KEYWORDS)


def classify_damage_type(permit_type: str, work_desc: str) -> str:
    text = f"{permit_type} {work_desc}".lower()

    if any(w in text for w in ["fire", "smoke", "arson"]):
        return "Fire"
    if any(w in text for w in ["flood", "water damage", "water intrusion", "inundation",
                                "surge", "elevation", "mitigation"]):
        return "Flood"
    if any(w in text for w in ["hurricane", "wind", "storm", "shutter", "soffit"]):
        return "Hurricane/Wind"
    if any(w in text for w in ["structural", "foundation", "load-bearing", "masonry",
                                "block wall", "retaining", "wall repair"]):
        return "Structural"
    if any(w in text for w in ["roof", "shingle", "decking", "re-deck", "redeck"]):
        return "Roof"

    # fallback
    if any(w in text for w in ["window", "door"]):
        return "Hurricane/Wind"
    if any(w in text for w in ["plumbing", "pipe"]):
        return "Flood"

    return "Roof"


def fetch_permits(limit: int = 500, offset: int = 0) -> list[dict[str, Any]]:
    """
    Fetch raw permit records from Miami-Dade Open Data API.
    Returns a list of permit dicts.
    """
    params = {
        "$limit": limit,
        "$offset": offset,
        "$order": "issue_date DESC",
    }

    try:
        resp = requests.get(MIAMI_DADE_API, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"[permits] Fetch error: {e}")
        return []


def scrape_damage_permits(max_records: int = 500) -> list[dict[str, Any]]:
    """
    Fetch permits from Miami-Dade API and filter to damage-related types.
    Returns a list of normalised lead dicts ready for dedup and insert.
    """
    raw_permits = fetch_permits(limit=max_records)
    results: list[dict[str, Any]] = []

    for record in raw_permits:
        permit_type = record.get("permit_type", "") or ""
        work_desc = record.get("work_description", "") or ""

        if not is_damage_related(permit_type, work_desc):
            continue

        owner_raw = record.get("owner1_last_name", "") or ""
        owner_name = owner_raw.strip().title() if owner_raw.strip() else "Property Owner"

        address = record.get("address", "Unknown Address") or "Unknown Address"
        issue_date_raw = record.get("issue_date", "") or ""

        try:
            from datetime import datetime, timezone
            issue_date = datetime.fromisoformat(
                issue_date_raw.replace("Z", "+00:00")
            ).date().isoformat()
        except (ValueError, AttributeError):
            from datetime import date
            issue_date = date.today().isoformat()

        damage_type = classify_damage_type(permit_type, work_desc)

        results.append({
            "owner_name": owner_name,
            "address": address,
            "city": "Miami",
            "zip": record.get("zip_code", "33101") or "33101",
            "folio_number": record.get("folio_number", "") or "",
            "damage_type": damage_type,
            "permit_type": permit_type,
            "permit_date": issue_date,
            "storm_event": "",
            "source": "permit",
            "status": "New",
            "contact_email": None,
            "contact_phone": None,
        })

    print(f"[permits] Fetched {len(raw_permits)} records, kept {len(results)} damage-related permits")
    return results


if __name__ == "__main__":
    permits = scrape_damage_permits()
    for p in permits[:5]:
        print(p)
