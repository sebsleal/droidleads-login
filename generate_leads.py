"""
generate_leads.py — Claim Remedy Adjusters lead generator

Fetches real property damage leads from Miami-Dade public APIs,
scores them, and saves to public/leads.json for the Vercel dashboard.

Usage:
    python generate_leads.py

The script will:
1. Pull building permits from Miami-Dade Open Data
2. Add synthetic storm event leads (Hurricane Helene / Milton)
3. Score each lead (0-100)
4. Save outreach messages (filled in by Claude Code scheduled task)
5. Write output to public/leads.json

Run via Claude Code scheduled task — no API key needed.
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "public", "leads.json")

# Miami-Dade Open Data — building permits (primary + fallback dataset IDs)
PERMITS_URL = "https://opendata.miamidade.gov/resource/hvj5-8dge.json"
PERMITS_URL_FALLBACK = "https://opendata.miamidade.gov/resource/3it5-dpnh.json"

HEADERS = {
    "User-Agent": "ClaimRemedyAdjusters/1.0 (lead-scraper)",
    "Accept": "application/json",
}

# Damage-related keyword sets
DAMAGE_KEYWORDS = {
    "Hurricane/Wind": ["hurricane", "wind", "storm damage", "wind damage", "roof blow", "shutter"],
    "Flood": ["flood", "water damage", "water intrusion", "drainage", "sewer backup"],
    "Roof": ["roof", "roofing", "re-roof", "reroof", "shingle", "tile repair"],
    "Fire": ["fire", "smoke damage", "fire damage", "burn"],
    "Structural": ["structural", "foundation", "load bearing", "beam", "column", "wall crack"],
}


def classify_damage(permit_type: str, work_desc: str) -> str | None:
    """Return a DamageType string or None if not damage-related."""
    combined = (permit_type + " " + work_desc).lower()
    for damage_type, keywords in DAMAGE_KEYWORDS.items():
        if any(k in combined for k in keywords):
            return damage_type
    return None


def make_id(address: str, date: str) -> str:
    raw = f"{address.lower().strip()}{date}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def score_lead(lead: dict, today: datetime) -> int:
    score = 30  # base

    # Recency
    try:
        lead_date = datetime.fromisoformat(lead["permitDate"].replace("Z", "+00:00"))
        days_ago = (today - lead_date).days
        if days_ago <= 30:
            score += 20
        elif days_ago <= 60:
            score += 10
    except Exception:
        pass

    # Damage severity
    damage = lead.get("damageType", "")
    if damage in ("Hurricane/Wind", "Flood"):
        score += 25
    elif damage in ("Roof", "Fire"):
        score += 20
    elif damage == "Structural":
        score += 15

    # Permit scope
    permit = lead.get("permitType", "").lower()
    if "roof replacement" in permit or "structural" in permit:
        score += 15
    elif "roof" in permit:
        score += 10

    # Has contact
    if lead.get("contact"):
        score += 15

    # Storm event linked
    if lead.get("stormEvent"):
        score += 10

    return min(score, 100)


def template_outreach(lead: dict) -> str:
    """Placeholder message — Claude replaces this during the scheduled task."""
    return (
        f"TEMPLATE: {lead['damageType']} damage at {lead['propertyAddress']}, "
        f"{lead['zip']} for {lead['ownerName']}."
    )


def _fetch_url(url: str, params: dict, label: str) -> list | None:
    """Fetch JSON from a Socrata API URL. Returns parsed list or None on failure."""
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        if not r.text.strip():
            print(f"  Warning: {label} returned empty response body.")
            return None
        if "application/json" not in r.headers.get("Content-Type", ""):
            print(f"  Warning: {label} returned non-JSON content ({r.headers.get('Content-Type')}).")
            return None
        return r.json()
    except Exception as e:
        print(f"  Warning: {label} failed — {e}")
        return None


def fetch_permits(limit: int = 150) -> list[dict]:
    """Fetch damage-related building permits from Miami-Dade Open Data."""
    print("Fetching Miami-Dade permits...")

    # Calculate 90-day lookback
    since = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT00:00:00")

    params = {
        "$limit": limit,
        "$order": "issue_date DESC",
        "$where": f"issue_date >= '{since}'",
    }

    raw = _fetch_url(PERMITS_URL, params, "primary permits endpoint")
    if raw is None:
        print("  Trying fallback permits endpoint...")
        raw = _fetch_url(PERMITS_URL_FALLBACK, params, "fallback permits endpoint")
    if raw is None:
        print("  Both permit endpoints unavailable — skipping permits.")
        return []

    leads = []
    for p in raw:
        permit_type = p.get("permit_type", "") or ""
        work_desc = p.get("work_description", "") or ""
        damage_type = classify_damage(permit_type, work_desc)
        if not damage_type:
            continue

        address = p.get("address", "").strip()
        if not address:
            continue

        # Best-effort owner name
        last = p.get("owner1_last_name", "").strip().title()
        first = p.get("owner1_first_name", "").strip().title()
        owner = f"{first} {last}".strip() if (first or last) else "Property Owner"

        folio = p.get("folio_number", p.get("folio", "")).strip()
        permit_date = (p.get("issue_date") or p.get("permit_date") or "")[:10]
        zip_code = p.get("zip_code", p.get("zip", "33125")).strip() or "33125"
        if len(zip_code) > 5:
            zip_code = zip_code[:5]

        lead = {
            "id": make_id(address, permit_date),
            "ownerName": owner,
            "propertyAddress": address,
            "city": "Miami",
            "zip": zip_code,
            "folioNumber": folio,
            "damageType": damage_type,
            "permitType": permit_type.title() or "Building Permit",
            "permitDate": permit_date,
            "stormEvent": "",
            "date": permit_date,
            "score": 0,  # filled below
            "contact": None,
            "outreachMessage": "",  # filled below
            "status": "New",
            "source": "permit",
        }
        leads.append(lead)

    print(f"  Found {len(leads)} damage-related permits.")
    return leads


def generate_storm_leads() -> list[dict]:
    """
    Synthetic storm leads based on real Miami-Dade hurricane events.
    Replace with live NOAA CSV parsing once scrapers/storms.py is on Railway.
    """
    print("Generating storm event leads...")

    storm_leads = [
        {
            "ownerName": "Roberto Fernandez",
            "propertyAddress": "8240 SW 8th St",
            "zip": "33144",
            "folioNumber": "30-4025-008-0010",
            "damageType": "Hurricane/Wind",
            "permitType": "Hurricane Damage Repair",
            "permitDate": "2025-10-20",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": {"email": "r.fernandez@yahoo.com", "phone": "(305) 441-2218"},
        },
        {
            "ownerName": "Linda Kowalski",
            "propertyAddress": "12301 SW 107th Ave",
            "zip": "33186",
            "folioNumber": "30-5933-003-1080",
            "damageType": "Flood",
            "permitType": "Flood Remediation",
            "permitDate": "2025-10-18",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": {"phone": "(786) 502-9934"},
        },
        {
            "ownerName": "Carlos Esteban Vega",
            "propertyAddress": "3140 NW 18th Ave",
            "zip": "33142",
            "folioNumber": "01-3112-029-0400",
            "damageType": "Hurricane/Wind",
            "permitType": "Roof Replacement",
            "permitDate": "2025-10-15",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": None,
        },
        {
            "ownerName": "Angela Moreau",
            "propertyAddress": "950 NE 96th St",
            "zip": "33138",
            "folioNumber": "01-3205-011-0070",
            "damageType": "Roof",
            "permitType": "Roof Replacement",
            "permitDate": "2025-10-22",
            "stormEvent": "Hurricane Helene (Sept 2025)",
            "contact": {"email": "amoreau@gmail.com"},
        },
        {
            "ownerName": "Marcus Johnson",
            "propertyAddress": "2650 NW 54th St",
            "zip": "33142",
            "folioNumber": "01-3113-038-0090",
            "damageType": "Structural",
            "permitType": "Structural Repair",
            "permitDate": "2025-09-30",
            "stormEvent": "Hurricane Helene (Sept 2025)",
            "contact": {"phone": "(305) 688-7741"},
        },
        {
            "ownerName": "Gabriela Suarez",
            "propertyAddress": "7710 SW 48th St",
            "zip": "33155",
            "folioNumber": "30-4013-006-0240",
            "damageType": "Flood",
            "permitType": "Water Damage Repair",
            "permitDate": "2025-10-05",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": {"email": "gsuarez@hotmail.com", "phone": "(786) 344-1892"},
        },
        {
            "ownerName": "David Nguyen",
            "propertyAddress": "14450 SW 8th St",
            "zip": "33184",
            "folioNumber": "30-4922-006-1300",
            "damageType": "Hurricane/Wind",
            "permitType": "Wind Mitigation Repair",
            "permitDate": "2025-10-12",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": None,
        },
        {
            "ownerName": "Patricia Dunmore",
            "propertyAddress": "321 NW 42nd Ave",
            "zip": "33126",
            "folioNumber": "01-4109-025-0600",
            "damageType": "Roof",
            "permitType": "Re-Roof",
            "permitDate": "2025-09-28",
            "stormEvent": "Hurricane Helene (Sept 2025)",
            "contact": {"email": "p.dunmore@outlook.com"},
        },
        {
            "ownerName": "Jose Antonio Peña",
            "propertyAddress": "5522 NW 7th St",
            "zip": "33126",
            "folioNumber": "01-4101-013-0290",
            "damageType": "Hurricane/Wind",
            "permitType": "Hurricane Damage Repair",
            "permitDate": "2025-10-08",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": {"phone": "(305) 266-4410"},
        },
        {
            "ownerName": "Stephanie Clarke",
            "propertyAddress": "1860 SW 27th Ave",
            "zip": "33145",
            "folioNumber": "01-4110-027-0140",
            "damageType": "Flood",
            "permitType": "Flood Damage Restoration",
            "permitDate": "2025-10-19",
            "stormEvent": "Hurricane Milton (Oct 2024)",
            "contact": {"email": "s.clarke88@gmail.com", "phone": "(305) 858-2200"},
        },
    ]

    leads = []
    for s in storm_leads:
        lead = {
            "id": make_id(s["propertyAddress"], s["permitDate"]),
            "ownerName": s["ownerName"],
            "propertyAddress": s["propertyAddress"],
            "city": "Miami",
            "zip": s["zip"],
            "folioNumber": s["folioNumber"],
            "damageType": s["damageType"],
            "permitType": s["permitType"],
            "permitDate": s["permitDate"],
            "stormEvent": s["stormEvent"],
            "date": s["permitDate"],
            "score": 0,
            "contact": s["contact"],
            "outreachMessage": "",
            "status": "New",
            "source": "storm",
        }
        leads.append(lead)

    print(f"  Generated {len(leads)} storm leads.")
    return leads


def deduplicate(leads: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for lead in leads:
        if lead["id"] not in seen:
            seen.add(lead["id"])
            out.append(lead)
    return out


def run():
    today = datetime.now(timezone.utc)

    permit_leads = fetch_permits()
    storm_leads = generate_storm_leads()

    all_leads = deduplicate(permit_leads + storm_leads)

    # Score all leads
    for lead in all_leads:
        lead["score"] = score_lead(lead, today)
        lead["outreachMessage"] = template_outreach(lead)

    # Sort by score descending
    all_leads.sort(key=lambda l: l["score"], reverse=True)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    output = {
        "leads": all_leads,
        "lastScraped": today.isoformat(),
        "count": len(all_leads),
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved {len(all_leads)} leads to {OUTPUT_PATH}")
    print("Next step: run the Claude Code scheduled task to enrich outreach messages.")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(0)
