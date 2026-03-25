"""
generate_leads.py — Claim Remedy Adjusters lead generator

Fetches real property damage leads from two live sources:
  1. Miami-Dade building permits via ArcGIS Feature Service (real addresses + owners)
  2. NOAA Storm Events CSV files (used to tag permits with the causal storm)

Usage:
    python generate_leads.py

The script will:
1. Pull building permits from Miami-Dade ArcGIS REST API (90-day lookback)
2. Pull recent storm events from NOAA for Miami-Dade County
3. Cross-reference: tag each permit with the storm that likely caused it
4. Score each lead (0-100)
5. Save outreach message placeholders (filled in by Claude Code scheduled task)
6. Write output to public/leads.json

Run via Claude Code scheduled task — no API key needed.
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "public", "leads.json")

# Miami-Dade ArcGIS Feature Service — "Building Permits Issued By Miami-Dade County"
# Dataset: https://hub.arcgis.com/datasets/6db5f56e886446df88313ca279e59120_0
ARCGIS_PERMITS_URL = (
    "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/"
    "miamidade_permit_data/FeatureServer/0/query"
)

HEADERS = {
    "User-Agent": "ClaimRemedyAdjusters/1.0 (lead-scraper)",
    "Accept": "application/json",
}

# Damage-related keyword sets (matched against DetailDescriptionComments)
DAMAGE_KEYWORDS = {
    "Hurricane/Wind": ["hurricane", "wind", "storm damage", "wind damage", "roof blow", "shutter"],
    "Flood": ["flood", "water damage", "water intrusion", "drainage", "sewer backup"],
    "Roof": ["roof", "roofing", "re-roof", "reroof", "shingle", "tile repair", "metal roof"],
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


def parse_owner_name(raw: str) -> tuple[str, str]:
    """
    Parse ArcGIS OwnerName (e.g. 'YAUDI RODRIGUEZ CHAVEZ') into (full_name, last_name).
    Handles joint ownership like 'LAZARO ROIG &W PEGGY'.
    """
    if not raw or not raw.strip():
        return "Property Owner", "Owner"

    # Strip joint-ownership suffixes like '&W PEGGY', '&H JOHN', 'ETAL', 'TR', 'EST'
    name = raw.strip()
    for suffix in [" &W ", " &H ", " & ", " ETAL", " TR ", " EST "]:
        idx = name.upper().find(suffix)
        if idx > 0:
            name = name[:idx]

    parts = name.strip().title().split()
    if not parts:
        return "Property Owner", "Owner"

    last_name = parts[-1]
    full_name = " ".join(parts)
    return full_name, last_name


def score_lead(lead: dict, today: datetime) -> int:
    score = 30  # base

    # Recency
    try:
        lead_date = datetime.fromisoformat(lead["permitDate"].replace("Z", "+00:00"))
        if lead_date.tzinfo is None:
            lead_date = lead_date.replace(tzinfo=timezone.utc)
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


def fetch_permits(limit: int = 200) -> list[dict]:
    """Fetch damage-related building permits from Miami-Dade ArcGIS Feature Service."""
    print("Fetching Miami-Dade permits (ArcGIS)...")

    since = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")

    # Build WHERE clause — keyword match in description
    kw_clauses = []
    all_keywords = [
        "roof", "reroof", "re-roof", "hurricane", "flood", "wind damage",
        "water damage", "structural", "fire damage", "storm", "shingle",
        "shutter", "elevation", "mitigation",
    ]
    for kw in all_keywords:
        kw_clauses.append(f"DetailDescriptionComments LIKE '%{kw}%'")

    where = f"PermitIssuedDate >= DATE '{since}' AND ({' OR '.join(kw_clauses)})"

    params = {
        "where": where,
        "outFields": (
            "PermitIssuedDate,PermitNumber,PermitType,DetailDescriptionComments,"
            "FolioNumber,OwnerName,PropertyAddress,City,ContractorPhone"
        ),
        "resultRecordCount": limit,
        "orderByFields": "PermitIssuedDate DESC",
        "f": "json",
    }

    try:
        r = requests.get(ARCGIS_PERMITS_URL, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            print(f"  ArcGIS error: {data['error']}")
            return []
        features = data.get("features", [])
        print(f"  Got {len(features)} permit records from ArcGIS.")
        return features
    except Exception as e:
        print(f"  Warning: ArcGIS permits fetch failed — {e}")
        return []


def fetch_noaa_storm_events(lookback_years: int = 2) -> list[dict]:
    """
    Download NOAA storm event CSV files for Miami-Dade and return parsed events.
    Returns list of dicts with keys: storm_event, damage_type, event_date.
    """
    print("Fetching NOAA storm events...")
    try:
        from scrapers.storms import scrape_storm_events
        current_year = datetime.now().year
        years = list(range(current_year - lookback_years + 1, current_year + 1))
        events = scrape_storm_events(years)
        print(f"  Got {len(events)} Miami-Dade storm events from NOAA.")
        return events
    except Exception as e:
        print(f"  Warning: NOAA storm fetch failed — {e}")
        return []


def build_storm_windows(storm_events: list[dict]) -> list[dict]:
    """
    Collapse storm events into named windows.
    Returns list of dicts: {label, damage_type, date, window_start, window_end}
    where permits issued within the window are attributed to this storm.
    """
    # Group by storm name/label and get earliest date per group
    groups: dict[str, dict] = {}
    for ev in storm_events:
        label = ev.get("storm_event", "")
        ev_date_str = ev.get("permit_date", "")
        try:
            ev_date = datetime.fromisoformat(ev_date_str)
        except Exception:
            continue

        if label not in groups:
            groups[label] = {
                "label": label,
                "damage_type": ev.get("damage_type", "Hurricane/Wind"),
                "earliest": ev_date,
            }
        else:
            if ev_date < groups[label]["earliest"]:
                groups[label]["earliest"] = ev_date

    windows = []
    for g in groups.values():
        start = g["earliest"]
        windows.append({
            "label": g["label"],
            "damage_type": g["damage_type"],
            "window_start": start,
            "window_end": start + timedelta(days=120),  # permits filed up to 120 days after
        })

    return windows


def match_storm(permit_date_str: str, storm_windows: list[dict]) -> str:
    """Return the storm event label for a permit date, or empty string."""
    try:
        permit_date = datetime.fromisoformat(permit_date_str)
    except Exception:
        return ""

    # Find the most recent storm whose window contains this permit date
    best = None
    for w in storm_windows:
        if w["window_start"] <= permit_date <= w["window_end"]:
            if best is None or w["window_start"] > best["window_start"]:
                best = w

    return best["label"] if best else ""


def permits_to_leads(features: list[dict], storm_windows: list[dict]) -> list[dict]:
    """Convert ArcGIS feature records to lead dicts."""
    leads = []
    for feat in features:
        attrs = feat.get("attributes", {})

        permit_type = (attrs.get("PermitType") or "").strip()
        work_desc = (attrs.get("DetailDescriptionComments") or "").strip()
        damage_type = classify_damage(permit_type, work_desc)
        if not damage_type:
            continue

        address = (attrs.get("PropertyAddress") or "").strip()
        if not address:
            continue

        raw_owner = (attrs.get("OwnerName") or "").strip()
        owner_full, _ = parse_owner_name(raw_owner)

        folio = (attrs.get("FolioNumber") or "").strip()
        permit_date = (attrs.get("PermitIssuedDate") or "")[:10]  # already 'YYYY-MM-DD'
        city = (attrs.get("City") or "Miami").strip().title() or "Miami"

        # Build contact from contractor phone (best available without a property lookup)
        phone = (attrs.get("ContractorPhone") or "").strip() or None
        contact = {"phone": phone} if phone else None

        storm_event = match_storm(permit_date, storm_windows)

        leads.append({
            "id": make_id(address, permit_date),
            "ownerName": owner_full,
            "propertyAddress": address.title(),
            "city": city,
            "zip": "",
            "folioNumber": folio,
            "damageType": damage_type,
            "permitType": work_desc.title() or permit_type.title() or "Building Permit",
            "permitDate": permit_date,
            "stormEvent": storm_event,
            "date": permit_date,
            "score": 0,
            "contact": contact,
            "outreachMessage": "",
            "status": "New",
            "source": "permit",
        })

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

    # 1. Fetch permits from ArcGIS
    permit_features = fetch_permits()

    # 2. Fetch NOAA storm events for cross-referencing
    storm_events = fetch_noaa_storm_events(lookback_years=2)
    storm_windows = build_storm_windows(storm_events)
    print(f"  Built {len(storm_windows)} storm windows for cross-referencing.")

    # 3. Convert permits to leads, tagged with storm events
    leads = permits_to_leads(permit_features, storm_windows)
    leads = deduplicate(leads)

    # 4. Initial score + outreach templates
    for lead in leads:
        lead["score"] = score_lead(lead, today)
        lead["outreachMessage"] = template_outreach(lead)

    # 5. Sort by score, then PA-enrich top 40 (adds ZIP, homestead, mailing address,
    #    assessed value, and applies +10 bonus for owner-occupied properties)
    leads.sort(key=lambda l: l["score"], reverse=True)
    try:
        from scrapers.property import enrich_leads
        leads = enrich_leads(leads, top_n=40, delay=0.4)
        # Re-sort after homestead score boosts
        leads.sort(key=lambda l: l["score"], reverse=True)
    except Exception as e:
        print(f"  Warning: PA enrichment failed — {e}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    output = {
        "leads": leads,
        "lastScraped": today.isoformat(),
        "count": len(leads),
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved {len(leads)} leads to {OUTPUT_PATH}")
    storm_linked = sum(1 for l in leads if l.get("stormEvent"))
    with_contact = sum(1 for l in leads if l.get("contact"))
    homesteaded = sum(1 for l in leads if l.get("homestead"))
    print(f"  Storm-linked: {storm_linked} | With contact: {with_contact} | Homesteaded: {homesteaded}")
    print("Next step: run the Claude Code scheduled task to enrich outreach messages.")


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        sys.exit(0)
