"""
Multi-county building permits scraper — ArcGIS Feature Services.

Supported counties (via COUNTY_CONFIGS):
  - miami-dade: Active — ArcGIS Feature Service confirmed working
  - broward:    Active — Fort Lauderdale MapServer + Broward REST View FeatureServer
  - palm-beach: Disabled — flip enabled=True once ArcGIS URL confirmed
                via https://opendata2-pbcgov.opendata.arcgis.com → "permits"

Public APIs — no key required.
"""

import requests
from datetime import datetime, timedelta, timezone
from typing import Any

from scrapers.retry_utils import retry_request

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
        # Service rejects WHERE clauses with 35 LIKE conditions (URL too long → 404).
        # Use core keywords for the API query; full DAMAGE_KEYWORDS filtering applied locally.
        "where_keywords": [
            "roof", "reroof", "hurricane", "flood", "fire", "structural",
            "water damage", "wind damage", "storm", "pipe", "discharge", "mold",
        ],
        "enabled": True,
    },
    "miami-dade-gdb": {
        # BuildingPermit_gdb — second Miami-Dade source, 262K records back to 1982.
        # Complements miamidade_permit_data (different dataset, ~120K unique records).
        # No OwnerName/City but PA lookup downstream fills those in via folio number.
        # county_slug overrides the dict key so leads still appear as miami-dade in the UI.
        "url": (
            "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/"
            "BuildingPermit_gdb/FeatureServer/0/query"
        ),
        "where_field":      "DESC1",
        "out_fields": (
            "ID,TYPE,ISSUDATE,ADDRESS,FOLIO,ESTVALUE,CONTRNAME,BPSTATUS,DESC1,APPTYPE"
        ),
        "date_field":       "ISSUDATE",
        "address_field":    "ADDRESS",
        "owner_field":      None,
        "folio_field":      "FOLIO",
        "phone_field":      None,
        "contractor_field": "CONTRNAME",
        "value_field":      "ESTVALUE",
        "inspection_field": None,
        "city_field":       None,
        "default_city":     "Miami",
        "county_slug":      "miami-dade",
        "where_keywords": [
            "roof", "reroof", "hurricane", "flood", "fire", "structural",
            "water damage", "wind damage", "storm", "pipe", "discharge", "mold",
        ],
        "enabled": True,
    },
    "broward": {
        # Multi-city Broward permit scraping.
        # Individual city endpoints are defined in "endpoints" sub-config.
        # Each endpoint is tried in turn; leads are deduplicated after collection.
        # SUBMITDT is the reliable date field across all Broward MapServers;
        # APPROVEDT is null on most records.
        #
        # Confirmed working (2026-03):
        #   - Fort Lauderdale: https://gis.fortlauderdale.gov (MapServer)
        #   - Broward REST View: https://services5.arcgis.com/DllnbBENKfts6TQD (FeatureServer)
        #     Covers unincorporated Broward + municipalities that report to the county.
        #   - Broward HCED Posse Permits: https://bcgishub.broward.org (FeatureServer/layer 4)
        #     Covers unincorporated Broward + all municipalities, updated daily.
        #
        # Researched but not available / not working (2026-03):
        #   - Hollywood GIS portal: requires authentication (HTTP 499)
        #   - Pembroke Pines / Coral Springs / Pompano Beach: no public ArcGIS
        #     endpoints found; cities use Click2Gov web forms instead.
        #   - Broward County GIS: gis.broward.org returns 403/503.
        #
        # BCPA (web.bcpa.net): No public JSON API confirmed. For Broward PA
        # enrichment use the BCPA web map at https://gisweb-adapters.bcpa.net/
        # or scrape the angular SPA — see scrapers/property.py BCPA integration.
        #
        "endpoints": [
            {
                "name":       "fort-lauderdale",
                "url": (
                    "https://gis.fortlauderdale.gov/arcgis/rest/services/"
                    "BuildingPermitTracker/BuildingPermitTracker/MapServer/0/query"
                ),
                "where_field":  "PERMITDESC",
                "out_fields": (
                    "PERMITID,PERMITTYPE,PERMITDESC,PERMITSTAT,SUBMITDT,"
                    "PARCELID,FULLADDR,OWNERNAME,OWNERADDR,OWNERCITY,OWNERZIP,"
                    "CONTRACTOR,CONTRACTPH,ESTCOST,LASTUPDATEDATE"
                ),
                "date_field":   "SUBMITDT",
                "address_field": "FULLADDR",
                "owner_field":  "OWNERNAME",
                "folio_field":  "PARCELID",
                "phone_field":  "CONTRACTPH",
                "contractor_field": "CONTRACTOR",
                "value_field":   "ESTCOST",
                "inspection_field": "LASTUPDATEDATE",
                "city_field":    None,
                "default_city":  "Fort Lauderdale",
            },
            {
                "name":        "broward-county-wide",
                "url": (
                    "https://services5.arcgis.com/DllnbBENKfts6TQD/arcgis/rest/services/"
                    "Building_Permit_REST_View/FeatureServer/0/query"
                ),
                "where_field":  "description",
                "out_fields": (
                    "PermitID,Address,work_type,submissionDate,"
                    "applicantName,applicantPhone,total_cost"
                ),
                "date_field":   "submissionDate",
                "address_field": "Address",
                "owner_field":  "applicantName",
                "folio_field":   None,
                "phone_field":   "applicantPhone",
                "contractor_field": None,
                "value_field":   "total_cost",
                "inspection_field": None,
                "city_field":    None,
                "default_city":  "Broward County",
            },
            {
                "name":        "broward-hced-posse",
                "url": (
                    "https://bcgishub.broward.org/posse/rest/services/"
                    "HCED/HCEDPossePermitsRef/FeatureServer/4/query"
                ),
                "where_field":  "WORKDESCRIPTION",
                "out_fields": (
                    "PERMITNUM,PERMITTYPE,FISTATUS,PERMITTEE,OWNER,ISSUEDATE,"
                    "JOBADDRESS,LOCATION,WORKDESCRIPTION,CITY,CONTACT,ZIPCODE"
                ),
                "date_field":   "ISSUEDATE",
                "address_field": "JOBADDRESS",
                "owner_field":  "OWNER",
                "folio_field":   None,
                "phone_field":   "CONTACT",
                "contractor_field": "PERMITTEE",
                "value_field":   None,
                "inspection_field": None,
                "city_field":    "CITY",
                "default_city":  "Broward County",
            },
        ],
        # MapServer rejects WHERE clauses with >~15 LIKE conditions.
        # Use a short core list for the API; full DAMAGE_KEYWORDS applied locally.
        "where_keywords": [
            "roof", "reroof", "hurricane", "flood", "fire", "structural",
            "water damage", "wind", "storm", "mold", "pipe", "discharge",
        ],
        "enabled": True,
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
    # Accidental Discharge / plumbing — high-value claim type
    "discharge", "accidental", "pipe", "plumbing", "water intrusion", "leak",
    "mold", "sewage", "overflow", "toilet", "bathroom", "ac leak", "a/c leak",
    # Additional structural
    "collapse", "sinkhole", "retaining wall",
]


def is_damage_related(permit_type: str, work_desc: str) -> bool:
    text = f"{permit_type} {work_desc}".lower()
    return any(kw in text for kw in DAMAGE_KEYWORDS)


def classify_damage_type(permit_type: str, work_desc: str) -> str:
    text = f"{permit_type} {work_desc}".lower()

    if any(w in text for w in ["fire", "smoke", "arson"]):
        return "Fire"
    # Accidental Discharge — plumbing/water/mold claims (highest settlement rate)
    if any(w in text for w in ["discharge", "accidental", "pipe burst", "pipe break",
                                "water intrusion", "overflow", "toilet", "bathroom",
                                "sewage", "ac leak", "a/c leak", "mold", "sewer"]):
        return "Accidental Discharge"
    if any(w in text for w in ["flood", "water damage", "inundation", "surge",
                                "elevation", "mitigation"]):
        return "Flood"
    if any(w in text for w in ["hurricane", "wind", "storm", "shutter", "soffit"]):
        return "Hurricane/Wind"
    if any(w in text for w in ["structural", "foundation", "load-bearing", "masonry",
                                "block wall", "retaining", "wall repair", "collapse",
                                "sinkhole"]):
        return "Structural"
    if any(w in text for w in ["roof", "shingle", "decking", "re-deck", "redeck",
                                "reroof", "re-roof"]):
        return "Roof"
    if any(w in text for w in ["window", "door"]):
        return "Hurricane/Wind"
    if any(w in text for w in ["plumbing", "pipe", "leak"]):
        return "Accidental Discharge"

    return "Roof"


def _scrape_endpoint(
    endpoint: dict,
    county: str,
    max_records: int,
    lookback_days: int,
    city_filter: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch and normalize damage permits from a single ArcGIS endpoint.

    Args:
        endpoint:    Endpoint config dict.
        county:      County slug.
        max_records: Max records per endpoint.
        lookback_days: Lookback window.
        city_filter: Optional city name (case-insensitive) to filter results.
                     When set, records whose parsed city does not match are
                     dropped. Useful for area-specific storm candidate scans.

    Returns lead dicts with 'county' set to the county slug.
    """
    url = endpoint.get("url")
    if not url:
        return []

    since_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    where_field = endpoint["where_field"]
    date_field = endpoint["date_field"]

    query_keywords = endpoint.get("where_keywords", DAMAGE_KEYWORDS)
    kw_clauses = [f"{where_field} LIKE '%{kw}%'" for kw in query_keywords]
    since = since_dt.strftime("%Y-%m-%d")
    where = f"{date_field} >= DATE '{since}' AND ({' OR '.join(kw_clauses)})"

    base_params = {
        "where": where,
        "outFields": endpoint["out_fields"],
        "resultRecordCount": min(max_records, 1000),
        "orderByFields": f"{date_field} DESC",
        "f": "json",
    }

    all_features = []
    offset = 0
    endpoint_name = endpoint.get("name", "unknown")
    try:
        while True:
            params = {**base_params, "resultOffset": offset}
            resp = retry_request(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                print(f"[permits] ArcGIS error ({endpoint_name}): {data['error']}")
                break
            features = data.get("features", [])
            all_features.extend(features)
            if not data.get("exceededTransferLimit", False) or len(all_features) >= max_records:
                break
            offset += len(features)
            print(f"[permits] {endpoint_name}: paginating... fetched {len(all_features)} so far")
    except requests.RequestException as e:
        print(f"[permits] Fetch error ({endpoint_name}): {e}")
        return []

    results: list[dict[str, Any]] = []
    addr_field = endpoint["address_field"]
    owner_field = endpoint["owner_field"]
    folio_field = endpoint["folio_field"]
    phone_field = endpoint["phone_field"]
    contractor_field = endpoint["contractor_field"]
    value_field = endpoint.get("value_field")
    city_field = endpoint["city_field"]
    endpoint_default_city = endpoint["default_city"]

    for feat in all_features:
        attrs = feat.get("attributes", {})
        permit_type = (
            attrs.get("PermitType") or attrs.get("PERMITTYPE")
            or attrs.get("WorkType") or attrs.get("TYPE") or ""
        ).strip()
        work_desc = (attrs.get(where_field) or "").strip()

        if not is_damage_related(permit_type, work_desc):
            continue

        raw_owner = (attrs.get(owner_field) or "").strip() if owner_field else ""
        for suffix in [" &W ", " &H ", " & ", " ETAL", " TR ", " EST "]:
            idx = raw_owner.upper().find(suffix)
            if idx > 0:
                raw_owner = raw_owner[:idx]
        owner_name = raw_owner.strip().title() or "Property Owner"

        address = (attrs.get(addr_field) or "Unknown Address").strip().title()

        raw_date = attrs.get(date_field)
        if isinstance(raw_date, (int, float)) and raw_date > 1_000_000_000:
            try:
                permit_date = datetime.fromtimestamp(
                    raw_date / 1000, tz=timezone.utc
                ).strftime("%Y-%m-%d")
            except (TypeError, ValueError, OSError):
                permit_date = ""
        else:
            permit_date = str(raw_date or "")[:10]

        # Use endpoint's explicit city field, else the endpoint's default city name
        raw_city = attrs.get(city_field) if city_field else None
        city = (raw_city or endpoint_default_city or "").strip().title()
        if not city:
            city = endpoint_default_city or "Broward"

        # Apply area-specific city filter when candidate has city specificity.
        # Use case-insensitive partial match so "Deerfield" matches "Deerfield Beach".
        if city_filter:
            city_lower = city.lower()
            filter_lower = city_filter.lower()
            # Match if filter is contained in the record's city OR record's city
            # is contained in the filter (handles reversed specificity)
            if filter_lower not in city_lower and city_lower not in filter_lower:
                continue

        folio = (attrs.get(folio_field) or "").strip() if folio_field else ""
        phone = (attrs.get(phone_field) or "").strip() if phone_field else None
        contractor = (attrs.get(contractor_field) or "").strip() if contractor_field else None

        permit_value = 0
        if value_field:
            raw_val = attrs.get(value_field)
            if raw_val is not None:
                try:
                    permit_value = float(raw_val)
                except (TypeError, ValueError):
                    permit_value = 0

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
            "permit_value": permit_value,
            "contractor_name": contractor,
            "storm_event": "",
            "source": "permit",
            "status": "New",
            "contact_email": None,
            "contact_phone": phone,
            "county": county,
        })

    print(f"[permits] {endpoint_name}: fetched {len(all_features)} records, kept {len(results)} damage-related permits")
    return results


def scrape_damage_permits(
    county: str = "miami-dade",
    max_records: int = 500,
    lookback_days: int = 90,
    city: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch damage-related building permits for the given county.

    Supports two config structures:
      - Single-endpoint (miami-dade, palm-beach): uses `url` key directly
      - Multi-endpoint (broward): iterates over `endpoints` list, aggregates results

    Args:
        county:        County slug (e.g. "broward", "miami-dade").
        max_records:   Maximum total records to return across all endpoints.
        lookback_days: How many days back to search.
        city:          Optional city name to filter results to a specific
                       municipality within the county. When provided, only
                       records whose parsed city matches (case-insensitive)
                       are included.

    Returns a list of normalised lead dicts ready for dedup and insert.
    Each lead dict includes a 'county' field set to the county slug.
    """
    config = COUNTY_CONFIGS.get(county)
    if not config:
        print(f"[permits] Unknown county '{county}' — skipping")
        return []
    if not config.get("enabled", False):
        print(f"[permits] County '{county}' is disabled — skipping")
        return []

    # Multi-endpoint county: Broward has an "endpoints" list
    endpoints = config.get("endpoints")
    if endpoints:
        all_results: list[dict[str, Any]] = []
        # Collect up to max_records per endpoint
        per_endpoint = min(max_records, 500)
        for endpoint in endpoints:
            results = _scrape_endpoint(
                endpoint, county, per_endpoint, lookback_days, city_filter=city
            )
            all_results.extend(results)
            print(f"[permits] {county}: total so far {len(all_results)} damage-related permits")
            if len(all_results) >= max_records:
                break
        return all_results[:max_records]

    # Single-endpoint county (existing logic for miami-dade, palm-beach)
    if not config.get("url"):
        print(f"[permits] County '{county}' has no URL configured — skipping")
        return []

    # Build a synthetic single-endpoint dict for _scrape_endpoint
    single_endpoint = {
        "name":        county,
        "url":         config["url"],
        "where_field": config["where_field"],
        "out_fields":  config["out_fields"],
        "date_field":  config["date_field"],
        "address_field":    config["address_field"],
        "owner_field":     config["owner_field"],
        "folio_field":     config["folio_field"],
        "phone_field":      config["phone_field"],
        "contractor_field": config["contractor_field"],
        "value_field":      config.get("value_field"),
        "inspection_field":  config.get("inspection_field"),
        "city_field":       config["city_field"],
        "default_city":     config["default_city"],
        "where_keywords":   config.get("where_keywords", DAMAGE_KEYWORDS),
    }
    return _scrape_endpoint(single_endpoint, county, max_records, lookback_days, city_filter=city)


if __name__ == "__main__":
    permits = scrape_damage_permits("miami-dade", max_records=10)
    for p in permits[:5]:
        print(p)
