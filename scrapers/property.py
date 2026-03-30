"""
Miami-Dade Property Appraiser deep lookup.

Uses the PA public web service to retrieve per-folio:
  - Owner name + mailing address
  - ZIP code
  - Homestead exemption status (owner-occupied = warmer lead)
  - Assessed value (prioritise higher-value properties)

API endpoint: https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx
"""

import time
import requests
from typing import Any

PA_API_URL = (
    "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://apps.miamidadepa.gov/propertysearch/",
}


def lookup_by_folio(folio_number: str) -> dict[str, Any] | None:
    """
    Look up detailed property info from Miami-Dade Property Appraiser.

    Returns dict with keys:
        owner_name, mailing_address, mailing_city, mailing_state, mailing_zip,
        site_zip, homestead, assessed_value
    or None if not found / request failed.
    """
    folio_clean = folio_number.replace("-", "").strip()
    if not folio_clean:
        return None

    params = {
        "Operation": "GetPropertySearchByFolio",
        "folioNumber": folio_clean,
        "clientAppName": "PropertySearch",
    }
    try:
        r = requests.get(PA_API_URL, params=params, headers=HEADERS, timeout=15)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        if not r.text.strip():
            return None
        data = r.json()
    except Exception as e:
        print(f"  [PA] Lookup failed for folio {folio_number}: {e}")
        return None

    return _parse(data, folio_number)


def _parse(data: dict, folio_number: str) -> dict[str, Any] | None:
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
        info = lookup_by_folio(folio)
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
        info = lookup_by_folio(folio)
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
