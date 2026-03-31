"""
Property Appraiser enrichment.

County-aware routing:
  - county == "miami-dade"  → Miami-Dade PA (apps.miamidadepa.gov)
  - county == "broward"     → Broward County PA (web.bcpa.net BCPA web service)

Each lookup returns:
  - Owner name + mailing address
  - ZIP code
  - Homestead exemption status (owner-occupied = warmer lead)
  - Assessed value (prioritise higher-value properties)
"""

import time
import requests
from typing import Any

# Module-level cache for PA lookups: keyed by (folio_number, county_slug).
_pa_cache: dict[tuple[str, str], dict[str, Any] | None] = {}

# ---------------------------------------------------------------------------
# Miami-Dade PA
# ---------------------------------------------------------------------------
MIAMI_DADE_PA_URL = (
    "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx"
)

MD_PA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://apps.miamidadepa.gov/propertysearch/",
}

# ---------------------------------------------------------------------------
# Broward County PA (BCPA) — web.bcpa.net
# ---------------------------------------------------------------------------
# BCPA provides a web-service endpoint for folio lookups.
# The Angular SPA at https://web.bcpa.net/bcpaclient/ hits this proxy:
BCPA_PA_URL = (
    "https://web.bcpa.net/bcpaclient/api/property"
)

BCPA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://web.bcpa.net/bcpaclient/",
}


def lookup_by_folio(folio_number: str, county: str = "miami-dade") -> dict[str, Any] | None:
    """
    Look up detailed property info from the appropriate county Property Appraiser.

    County routing:
      - "miami-dade" (default): Miami-Dade PA API
      - "broward": Broward County PA (BCPA) API

    Returns dict with keys:
        owner_name, mailing_address, mailing_city, mailing_state, mailing_zip,
        site_zip, homestead, assessed_value
    or None if not found / request failed.
    """
    cache_key = (folio_number.strip(), county.strip().lower())
    if cache_key in _pa_cache:
        return _pa_cache[cache_key]

    if county == "broward":
        result = _lookup_by_folio_bcpa(folio_number)
    else:
        result = _lookup_by_folio_miami_dade(folio_number)

    _pa_cache[cache_key] = result
    return result


def _lookup_by_folio_miami_dade(folio_number: str) -> dict[str, Any] | None:
    """Look up property info from Miami-Dade Property Appraiser."""
    folio_clean = folio_number.replace("-", "").strip()
    if not folio_clean:
        return None

    params = {
        "Operation": "GetPropertySearchByFolio",
        "folioNumber": folio_clean,
        "clientAppName": "PropertySearch",
    }
    try:
        r = requests.get(MIAMI_DADE_PA_URL, params=params, headers=MD_PA_HEADERS, timeout=15)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        if not r.text.strip():
            return None
        data = r.json()
    except Exception as e:
        print(f"  [MD-PA] Lookup failed for folio {folio_number}: {e}")
        return None

    return _parse_miami_dade(data, folio_number)


def _lookup_by_folio_bcpa(folio_number: str) -> dict[str, Any] | None:
    """
    Look up property info from Broward County Property Appraiser (BCPA).

    BCPA folio numbers use the format XX-XXXX-XXX-XXXX (with hyphens)
    or a 13-digit numeric string. Both formats are accepted.
    """
    folio_clean = folio_number.replace("-", "").strip()
    if not folio_clean:
        return None

    # BCPA accepts folio in query string — try with and without hyphens
    params = {"folio": folio_clean}
    try:
        r = requests.get(BCPA_PA_URL, params=params, headers=BCPA_HEADERS, timeout=15)
        if r.status_code in (404, 400):
            return None
        r.raise_for_status()
        if not r.text.strip():
            return None
        data = r.json()
    except Exception as e:
        print(f"  [BCPA] Lookup failed for folio {folio_number}: {e}")
        return None

    return _parse_bcpa(data, folio_number)


def _parse_miami_dade(data: dict, folio_number: str) -> dict[str, Any] | None:
    """Parse the PA web service response."""
    if not isinstance(data, dict):
        return None

    # Owner name
    owner_infos = data.get("OwnerInfos") or []
    owner_name = ""
    if isinstance(owner_infos, list) and owner_infos:
        owner_name = (owner_infos[0].get("Name") or "").strip().title()

    # Mailing address
    mail = data.get("MailingAddress") or {}
    mailing_address = (mail.get("Address1") or "").strip()
    mailing_city = (mail.get("City") or "Miami").strip().title()
    mailing_state = (mail.get("State") or "FL").strip()
    mailing_zip = str(mail.get("ZipCode") or "").strip()[:5]

    # Site ZIP from SiteAddress
    site_addresses = data.get("SiteAddress") or []
    site_zip = ""
    if isinstance(site_addresses, list) and site_addresses:
        raw_zip = str(site_addresses[0].get("Zip") or "").strip()
        site_zip = raw_zip[:5]  # strip trailing "-0000"

    # Homestead: HxBaseYear non-zero means homestead exemption granted
    prop_info = data.get("PropertyInfo") or {}
    hx_base_year = prop_info.get("HxBaseYear")
    homestead = bool(hx_base_year and int(hx_base_year) > 0)

    # Assessed value — use most recent year's AssessedValue
    assessment = data.get("Assessment") or {}
    infos = assessment.get("AssessmentInfos") or []
    assessed_value = 0
    if infos:
        # First entry is current year
        assessed_value = int(infos[0].get("AssessedValue") or 0)

    if not owner_name:
        return None

    # Roof age from year built
    import datetime as _dt
    year_built_str = prop_info.get("YearBuilt") or prop_info.get("ActualYearBuilt") or ""
    try:
        year_built = int(str(year_built_str).strip())
        current_year = _dt.date.today().year
        if 1800 < year_built <= current_year:
            roof_age = current_year - year_built
        else:
            year_built = None
            roof_age = None
    except (ValueError, TypeError):
        year_built = None
        roof_age = None

    return {
        "owner_name": owner_name,
        "mailing_address": mailing_address,
        "mailing_city": mailing_city,
        "mailing_state": mailing_state,
        "mailing_zip": mailing_zip,
        "site_zip": site_zip,
        "homestead": homestead,
        "assessed_value": assessed_value,
        "folio_number": folio_number,
        "year_built": year_built if year_built_str else None,
        "roof_age": roof_age,
    }


def _parse_bcpa(data: dict, folio_number: str) -> dict[str, Any] | None:
    """
    Parse the BCPA (Broward County Property Appraiser) API response.

    BCPA JSON shape (preliminary — adjust field names once live response is captured):
    {
      "owner": "JOHN AND JANE DOE",
      "mailing_address": "123 MAILING ST",
      "mailing_city": "FORT LAUDERDALE",
      "mailing_state": "FL",
      "mailing_zip": "33301",
      "site_zip": "33312",
      "homestead": true,
      "assessed_value": 350000,
      "year_built": 1985,
      "roof_age": 40,
    }

    If the actual BCPA API returns a different shape, adjust the field
    accessors below to match. Logging prints the raw response so mismatches
    are visible in scraper output.
    """
    if not isinstance(data, dict):
        print(f"  [BCPA] Unexpected response type for folio {folio_number}: {type(data)}")
        return None

    # Log raw response keys so we can adjust field names when live data arrives
    print(f"  [BCPA] Response keys for folio {folio_number}: {list(data.keys())}")

    owner_name_raw = (
        data.get("owner")
        or data.get("owner_name")
        or data.get("OwnerName")
        or data.get("NAMECOMB")
        or ""
    ).strip()
    owner_name = owner_name_raw.title() or ""

    mailing_address = (
        data.get("mailing_address")
        or data.get("mailingAddress")
        or data.get("MAILADDR")
        or ""
    ).strip()

    mailing_city = (
        data.get("mailing_city")
        or data.get("mailingCity")
        or data.get("MAILCITY")
        or "Fort Lauderdale"
    ).strip().title()

    mailing_state = (
        data.get("mailing_state")
        or data.get("mailingState")
        or data.get("MAILSTATE")
        or "FL"
    ).strip().upper()

    mailing_zip = str(
        data.get("mailing_zip")
        or data.get("mailingZip")
        or data.get("MAILZIP")
        or ""
    ).strip()[:5]

    site_zip = str(
        data.get("site_zip")
        or data.get("siteZip")
        or data.get("SITEZIP")
        or ""
    ).strip()[:5]

    # Homestead: BCPA may return a boolean or a string "Y"/"N"
    homestead_raw = data.get("homestead") or data.get("HomesteadExemption") or data.get("SOH")
    if isinstance(homestead_raw, bool):
        homestead = homestead_raw
    elif isinstance(homestead_raw, str):
        homestead = homestead_raw.upper() in ("Y", "YES", "TRUE")
    else:
        homestead = bool(homestead_raw)

    # Assessed value
    assessed_value = 0
    av = data.get("assessed_value") or data.get("AssessedValue") or data.get("AV") or 0
    try:
        assessed_value = int(float(av))
    except (ValueError, TypeError):
        pass

    # Year built / roof age
    year_built = None
    roof_age = None
    yb = data.get("year_built") or data.get("YearBuilt") or data.get("ACTYEARBLT") or 0
    try:
        year_built = int(float(yb))
        import datetime as _dt
        current_year = _dt.date.today().year
        if 1800 < year_built <= current_year:
            roof_age = current_year - year_built
        else:
            year_built = None
    except (ValueError, TypeError):
        pass

    if not owner_name:
        return None

    return {
        "owner_name": owner_name,
        "mailing_address": mailing_address,
        "mailing_city": mailing_city,
        "mailing_state": mailing_state,
        "mailing_zip": mailing_zip,
        "site_zip": site_zip,
        "homestead": homestead,
        "assessed_value": assessed_value,
        "folio_number": folio_number,
        "year_built": year_built,
        "roof_age": roof_age,
    }


def enrich_leads(
    leads: list[dict],
    top_n: int = 40,
    delay: float = 0.4,
) -> list[dict]:
    """
    PA-enrich the top N leads (by score) that have a folio number.

    Fills in: zip, ownerMailingAddress, homestead, assessedValue.
    Applies a +10 score boost for homesteaded (owner-occupied) properties.

    Args:
        leads:  List of lead dicts, pre-sorted by score descending.
        top_n:  Max number of PA lookups to perform.
        delay:  Seconds to wait between requests (rate-limit guard).
    """
    eligible = [l for l in leads if l.get("folioNumber", "").strip()]
    to_enrich = eligible[:top_n]

    print(f"\nPA enrichment: {len(to_enrich)} lookups (top {top_n} leads with folios)...")

    enriched_ids = set()
    for i, lead in enumerate(to_enrich):
        folio = lead["folioNumber"]
        county_slug = str(lead.get("county", "miami-dade")).lower()
        info = lookup_by_folio(folio, county=county_slug)
        if info:
            # Fill ZIP from PA if missing
            if not lead.get("zip") and (info["site_zip"] or info["mailing_zip"]):
                lead["zip"] = info["site_zip"] or info["mailing_zip"]

            # Override owner name if we got a better one
            if info["owner_name"] and info["owner_name"] != "Property Owner":
                lead["ownerName"] = info["owner_name"]

            # Mailing address (may differ from site — absentee owner indicator)
            if info["mailing_address"]:
                mailing = info["mailing_address"]
                if info["mailing_city"]:
                    mailing += f", {info['mailing_city']}"
                if info["mailing_state"]:
                    mailing += f", {info['mailing_state']}"
                if info["mailing_zip"]:
                    mailing += f" {info['mailing_zip']}"
                lead["ownerMailingAddress"] = mailing

            # Homestead flag
            lead["homestead"] = info["homestead"]

            # Assessed value
            if info["assessed_value"]:
                lead["assessedValue"] = info["assessed_value"]

            # Score boost: owner-occupied = more likely to file their own claim
            if info["homestead"]:
                lead["score"] = min(lead["score"] + 10, 100)

            # Roof age
            if info.get("roof_age") is not None:
                lead["roofAge"] = info["roof_age"]
                if info["roof_age"] > 15:
                    lead["score"] = min(lead["score"] + 10, 100)

            # Absentee owner — out-of-state mailing address
            mailing_state = (info.get("mailing_state") or "").upper().strip()
            is_absentee = mailing_state not in ("FL", "FLORIDA", "")
            lead["absenteeOwner"] = is_absentee
            if is_absentee:
                lead["score"] = min(lead["score"] + 10, 100)

            enriched_ids.add(lead["id"])
            absentee_str = " | absentee" if is_absentee else ""
            status = "homestead" if info["homestead"] else "non-homestead"
            print(f"  [{i+1}/{len(to_enrich)}] {lead['propertyAddress'][:40]} — {status}{absentee_str}")
        else:
            print(f"  [{i+1}/{len(to_enrich)}] {lead['propertyAddress'][:40]} — no PA data")

        if i < len(to_enrich) - 1:
            time.sleep(delay)

    print(f"  PA enrichment complete. Enriched: {len(enriched_ids)}/{len(to_enrich)}")
    return leads


def enrich_leads_with_owner_info(
    leads: list[dict[str, Any]],
    max_lookups: int = 100,
    delay: float = 0.4,
) -> list[dict[str, Any]]:
    """
    Lightweight PA enrichment for the scraper pipeline (snake_case fields).

    Populates owner_name, zip, mailing address, homestead, assessed_value,
    roof_age, absentee_owner when available. Preserves existing non-None values.

    Args:
        leads: List of lead dicts (snake_case).
        max_lookups: Max number of PA lookups to perform.
        delay: Seconds between requests.
    """
    eligible = [l for l in leads if str(l.get("folio_number") or "").strip()]
    to_enrich = eligible[:max_lookups]

    print(f"\nPA enrichment: {len(to_enrich)} lookups (top {max_lookups} leads with folios)...")

    enriched_ids = set()
    for i, lead in enumerate(to_enrich):
        folio = str(lead.get("folio_number") or "").strip()
        county_slug = str(lead.get("county") or "miami-dade").lower()
        info = lookup_by_folio(folio, county=county_slug)
        if info:
            if lead.get("zip") is None and (info["site_zip"] or info["mailing_zip"]):
                lead["zip"] = info["site_zip"] or info["mailing_zip"]

            if info["owner_name"] and info["owner_name"] != "Property Owner":
                lead["owner_name"] = info["owner_name"]

            if info.get("mailing_address"):
                mailing = info["mailing_address"]
                if info.get("mailing_city"):
                    mailing += f", {info['mailing_city']}"
                if info.get("mailing_state"):
                    mailing += f", {info['mailing_state']}"
                if info.get("mailing_zip"):
                    mailing += f" {info['mailing_zip']}"
                if lead.get("owner_mailing_address") is None:
                    lead["owner_mailing_address"] = mailing

            if lead.get("homestead") is None:
                lead["homestead"] = info.get("homestead")

            if info.get("assessed_value") and lead.get("assessed_value") is None:
                lead["assessed_value"] = info["assessed_value"]

            if info.get("roof_age") is not None and lead.get("roof_age") is None:
                lead["roof_age"] = info["roof_age"]

            mailing_state = (info.get("mailing_state") or "").upper().strip()
            is_absentee = mailing_state not in ("FL", "FLORIDA", "")
            lead.setdefault("absentee_owner", is_absentee)

            enriched_ids.add(lead.get("id") or folio)
            absentee_str = " | absentee" if is_absentee else ""
            status = "homestead" if info.get("homestead") else "non-homestead"
            address = lead.get("address") or ""
            print(f"  [{i+1}/{len(to_enrich)}] {address[:40]} — {status}{absentee_str}")
        else:
            address = lead.get("address") or ""
            print(f"  [{i+1}/{len(to_enrich)}] {address[:40]} — no PA data")

        if i < len(to_enrich) - 1:
            time.sleep(delay)

    print(f"  PA enrichment complete. Enriched: {len(enriched_ids)}/{len(to_enrich)}")
    return leads


if __name__ == "__main__":
    result = lookup_by_folio("3059340350540")
    print(result)
