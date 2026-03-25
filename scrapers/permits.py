"""
Multi-county building permits scraper — ArcGIS Feature Services.

Supported counties (via COUNTY_CONFIGS):
  - miami-dade: Active — ArcGIS Feature Service confirmed working
  - broward:    Disabled — flip enabled=True once ArcGIS URL confirmed
                via https://geohub-bcgis.opendata.arcgis.com → "building permits"
  - palm-beach: Disabled — flip enabled=True once ArcGIS URL confirmed
                via https://opendata2-pbcgov.opendata.arcgis.com → "permits"

Public APIs — no key required.
"""

import requests
from datetime import datetime, timedelta, timezone
from typing import Any

# ---------------------------------------------------------------------------
# County configurations
# ---------------------------------------------------------------------------
COUNTY_CONFIGS: dict[str, dict] = {
    "miami-dade": {
        "url": (
            "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/"
            "miamidade_permit_data/FeatureServer/0/query"
        ),
        "where_field":      "DetailDescriptionComments",
        "out_fields": (
            "PermitIssuedDate,PermitNumber,PermitType,DetailDescriptionComments,"
            "FolioNumber,OwnerName,PropertyAddress,City,ContractorPhone,"
            "ContractorName,EstimatedValue,LastInspectionDate"
        ),
        "date_field":        "PermitIssuedDate",
        "address_field":     "PropertyAddress",
        "owner_field":       "OwnerName",
        "folio_field":       "FolioNumber",
        "phone_field":       "ContractorPhone",
        "contractor_field":  "ContractorName",
        "value_field":       "EstimatedValue",
        "inspection_field":  "LastInspectionDate",
        "city_field":        "City",
        "default_city":      "Miami",
        "enabled": True,
    },
    "broward": {
        # Fort Lauderdale city permits — confirmed working, 91K+ records.
        # Field names verified via ?f=json on the service.
        #
        # NOTE: This is a MapServer (not FeatureServer). The query API is identical
        #       but date range filtering uses epoch milliseconds, not DATE 'YYYY-MM-DD'.
        #       The scraper's WHERE clause will need adjustment if you enable this —
        #       see the comment in scrape_damage_permits() below.
        #
        # NOTE: Covers Fort Lauderdale only (largest city in Broward County ~200K people).
        #       County-wide endpoint exists but is intermittently offline (503):
        #         https://gis.broward.org/arcgis/rest/services/ePermits/ePermits/FeatureServer/0
        #       Swap the url below to that when it's back online.
        "url": "https://gis.fortlauderdale.gov/arcgis/rest/services/GeneralPurpose/gisdata/MapServer/27/query",
        "where_field":       "PERMITDESC",
        "out_fields": (
            "PERMITID,PERMITTYPE,PERMITDESC,PERMITSTAT,APPROVEDT,SUBMITDT,"
            "PARCELID,FULLADDR,OWNERNAME,OWNERADDR,OWNERCITY,OWNERZIP,"
            "CONTRACTOR,ESTCOST,USECLASS,LASTUPDATEDATE"
        ),
        "date_field":        "APPROVEDT",
        "address_field":     "FULLADDR",
        "owner_field":       "OWNERNAME",
        "folio_field":       "PARCELID",
        "phone_field":       None,
        "contractor_field":  "CONTRACTOR",
        "value_field":       "ESTCOST",
        "inspection_field":  "LASTUPDATEDATE",
        "city_field":        None,           # full address already includes city
        "default_city":      "Fort Lauderdale",
        "enabled": False,   # flip to True to activate Fort Lauderdale permits
    },
    "palm-beach": {
        # No public unauthenticated building permit API exists for Palm Beach County.
        #
        # Researched options (as of 2026-03):
        #   - PAO Permit Portal FeatureServer → requires auth token (HTTP 499)
        #     https://gis.pbcgov.org/arcgis/rest/services/PAO/Permit_Portal/FeatureServer/0
        #   - PZB Milestone Inspections (public) → structural recertifications only, not damage permits
        #     https://gis.pbcgov.org/arcgis/rest/services/PZB/PZB_MILESTONE_INSPECTION_NEW/FeatureServer/1
        #   - opendata2-pbcgov.opendata.arcgis.com → 27 datasets published, none are building permits
        #   - County distributes permit data via quarterly PDF reports only:
        #     https://discover.pbcgov.org/pzb/planning/pages/permit-activity-reports.aspx
        #
        # Leave disabled until Palm Beach County publishes a public REST API.
        "url": "",
        "where_field":       "WORKDESCRIPTION",
        "out_fields":        "*",
        "date_field":        "ISSUEDATE",
        "address_field":     "ADDRESS",
        "owner_field":       "OWNERNAME",
        "folio_field":       "PARCELNO",
        "phone_field":       None,
        "contractor_field":  None,
        "value_field":       "ESTCOST",
        "inspection_field":  None,
        "city_field":        None,
        "default_city":      "West Palm Beach",
        "enabled": False,   # no public endpoint available as of 2026-03
    },
}

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


def scrape_damage_permits(
    county: str = "miami-dade",
    max_records: int = 500,
    lookback_days: int = 90,
) -> list[dict[str, Any]]:
    """
    Fetch damage-related building permits for the given county from its
    ArcGIS Feature Service.

    Returns a list of normalised lead dicts ready for dedup and insert.
    Each lead dict includes a 'county' field with the county slug.
    """
    config = COUNTY_CONFIGS.get(county)
    if not config:
        print(f"[permits] Unknown county '{county}' — skipping")
        return []
    if not config["enabled"]:
        print(f"[permits] County '{county}' is disabled — skipping")
        return []
    if not config["url"]:
        print(f"[permits] County '{county}' has no URL configured — skipping")
        return []

    since = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    where_field = config["where_field"]

    kw_clauses = [f"{where_field} LIKE '%{kw}%'" for kw in DAMAGE_KEYWORDS]
    date_field = config["date_field"]
    where = f"{date_field} >= DATE '{since}' AND ({' OR '.join(kw_clauses)})"

    base_params = {
        "where": where,
        "outFields": config["out_fields"],
        "resultRecordCount": min(max_records, 1000),
        "orderByFields": f"{date_field} DESC",
        "f": "json",
    }

    all_features = []
    offset = 0
    try:
        while True:
            params = {**base_params, "resultOffset": offset}
            resp = requests.get(config["url"], params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                print(f"[permits] ArcGIS error ({county}): {data['error']}")
                break
            features = data.get("features", [])
            all_features.extend(features)
            if not data.get("exceededTransferLimit", False) or len(all_features) >= max_records:
                break
            offset += len(features)
            print(f"[permits] {county}: paginating... fetched {len(all_features)} so far")
    except requests.RequestException as e:
        print(f"[permits] Fetch error ({county}): {e}")
        return []

    results: list[dict[str, Any]] = []

    addr_field       = config["address_field"]
    owner_field      = config["owner_field"]
    folio_field      = config["folio_field"]
    phone_field      = config["phone_field"]
    contractor_field = config["contractor_field"]
    city_field       = config["city_field"]
    default_city     = config["default_city"]

    for feat in all_features:
        attrs = feat.get("attributes", {})
        permit_type = (attrs.get("PermitType") or attrs.get("WorkType") or "").strip()
        work_desc = (attrs.get(where_field) or "").strip()

        if not is_damage_related(permit_type, work_desc):
            continue

        raw_owner = (attrs.get(owner_field) or "").strip()
        # Strip joint-ownership suffixes
        for suffix in [" &W ", " &H ", " & ", " ETAL", " TR ", " EST "]:
            idx = raw_owner.upper().find(suffix)
            if idx > 0:
                raw_owner = raw_owner[:idx]
        owner_name = raw_owner.strip().title() or "Property Owner"

        address = (attrs.get(addr_field) or "Unknown Address").strip().title()
        permit_date = (attrs.get(date_field) or "")[:10]
        city = (attrs.get(city_field) or default_city if city_field else default_city)
        city = (city or default_city).strip().title() or default_city
        folio = (attrs.get(folio_field) or "").strip()
        phone = (attrs.get(phone_field) or "").strip() if phone_field else None
        phone = phone or None

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
            "county": county,
        })

    print(f"[permits] {county}: fetched {len(all_features)} records, kept {len(results)} damage-related permits")
    return results


if __name__ == "__main__":
    permits = scrape_damage_permits("miami-dade", max_records=10)
    for p in permits[:5]:
        print(p)
