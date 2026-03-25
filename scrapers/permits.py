"""
Miami-Dade building permits scraper — ArcGIS Feature Service.

Dataset: "Building Permits Issued By Miami-Dade County - 2 Previous Years to Present"
Source: https://hub.arcgis.com/datasets/6db5f56e886446df88313ca279e59120_0
Service: https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/0

Public API — no key required.
"""

import requests
from datetime import datetime, timedelta, timezone
from typing import Any

ARCGIS_URL = (
    "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/"
    "miamidade_permit_data/FeatureServer/0/query"
)

DAMAGE_KEYWORDS = [
    "roof", "reroof", "re-roof", "hurricane", "flood", "fire", "structural",
    "wind damage", "water damage", "storm", "shingle", "shutter", "elevation",
    "mitigation", "rebuild", "foundation", "wall repair", "window", "door replacement",
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
    if any(w in text for w in ["roof", "shingle", "decking", "re-deck", "redeck",
                                "reroof", "re-roof"]):
        return "Roof"
    if any(w in text for w in ["window", "door"]):
        return "Hurricane/Wind"
    if any(w in text for w in ["plumbing", "pipe"]):
        return "Flood"

    return "Roof"


def scrape_damage_permits(max_records: int = 500, lookback_days: int = 90) -> list[dict[str, Any]]:
    """
    Fetch damage-related building permits from Miami-Dade ArcGIS Feature Service.
    Returns a list of normalised lead dicts ready for dedup and insert.
    """
    since = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")

    kw_clauses = [f"DetailDescriptionComments LIKE '%{kw}%'" for kw in DAMAGE_KEYWORDS]
    where = f"PermitIssuedDate >= DATE '{since}' AND ({' OR '.join(kw_clauses)})"

    params = {
        "where": where,
        "outFields": (
            "PermitIssuedDate,PermitNumber,PermitType,DetailDescriptionComments,"
            "FolioNumber,OwnerName,PropertyAddress,City,ContractorPhone"
        ),
        "resultRecordCount": max_records,
        "orderByFields": "PermitIssuedDate DESC",
        "f": "json",
    }

    try:
        resp = requests.get(ARCGIS_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[permits] Fetch error: {e}")
        return []

    if "error" in data:
        print(f"[permits] ArcGIS error: {data['error']}")
        return []

    features = data.get("features", [])
    results: list[dict[str, Any]] = []

    for feat in features:
        attrs = feat.get("attributes", {})
        permit_type = (attrs.get("PermitType") or "").strip()
        work_desc = (attrs.get("DetailDescriptionComments") or "").strip()

        if not is_damage_related(permit_type, work_desc):
            continue

        raw_owner = (attrs.get("OwnerName") or "").strip()
        # Strip joint-ownership suffixes
        for suffix in [" &W ", " &H ", " & ", " ETAL", " TR ", " EST "]:
            idx = raw_owner.upper().find(suffix)
            if idx > 0:
                raw_owner = raw_owner[:idx]
        owner_name = raw_owner.strip().title() or "Property Owner"

        address = (attrs.get("PropertyAddress") or "Unknown Address").strip().title()
        permit_date = (attrs.get("PermitIssuedDate") or "")[:10]
        city = (attrs.get("City") or "Miami").strip().title() or "Miami"
        folio = (attrs.get("FolioNumber") or "").strip()
        phone = (attrs.get("ContractorPhone") or "").strip() or None

        damage_type = classify_damage_type(permit_type, work_desc)

        results.append({
            "owner_name": owner_name,
            "address": address,
            "city": city,
            "zip": "",
            "folio_number": folio,
            "damage_type": damage_type,
            "permit_type": work_desc.title() or permit_type.title(),
            "permit_date": permit_date,
            "storm_event": "",
            "source": "permit",
            "status": "New",
            "contact_email": None,
            "contact_phone": phone,
        })

    print(f"[permits] Fetched {len(features)} records, kept {len(results)} damage-related permits")
    return results


if __name__ == "__main__":
    permits = scrape_damage_permits()
    for p in permits[:5]:
        print(p)
