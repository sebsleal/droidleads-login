"""
Miami-Dade Property Appraiser deep lookup.

Uses the PA public JSON API v1 to retrieve per-folio:
  - Owner name + mailing address
  - ZIP code
  - Homestead exemption status (owner-occupied = warmer lead)
  - Assessed value (prioritise higher-value properties)

API endpoint: https://www.miamidade.gov/Apps/PA/paapi/v1/folio/{folio}
"""

import time
import requests
from typing import Any

PA_API_URL = "https://www.miamidade.gov/Apps/PA/paapi/v1/folio/{folio}"

HEADERS = {
    "User-Agent": "ClaimRemedyAdjusters/1.0 (lead-scraper)",
    "Accept": "application/json",
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

    url = PA_API_URL.format(folio=folio_clean)
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
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
    """Parse the PA API v1 response."""
    if not isinstance(data, dict):
        return None

    # Owner info — may be nested under PropertyInfo or at root
    prop = data.get("PropertyInfo") or data.get("SiteInfo") or data
    owner_info = data.get("OwnerInfo") or data.get("Owner") or prop

    owner_name = (
        owner_info.get("Name") or owner_info.get("OwnerName")
        or owner_info.get("owner_name") or prop.get("OwnerName") or ""
    ).strip().title()

    # Mailing address
    mail = data.get("MailingInfo") or data.get("Mailing") or owner_info or prop
    mailing_address = (
        mail.get("Address1") or mail.get("MailingAddress1")
        or mail.get("MailingAddress") or mail.get("address") or ""
    ).strip()
    mailing_city = (
        mail.get("City") or mail.get("MailingCity") or "Miami"
    ).strip()
    mailing_state = (
        mail.get("State") or mail.get("MailingState") or "FL"
    ).strip()
    mailing_zip = str(
        mail.get("Zip") or mail.get("MailingZip") or mail.get("ZipCode") or ""
    ).strip()[:5]

    # Site ZIP — from property address
    site_zip = str(
        prop.get("SiteZip") or prop.get("Zip") or prop.get("ZipCode") or ""
    ).strip()[:5]

    # Homestead: look in exemptions array for code "HX" or text "HOMESTEAD"
    homestead = False
    exemptions = (
        data.get("ExemptionInfo") or data.get("Exemptions")
        or data.get("exemptions") or []
    )
    if isinstance(exemptions, list):
        for ex in exemptions:
            code = str(ex.get("Code") or ex.get("code") or "").upper()
            desc = str(ex.get("Description") or ex.get("desc") or "").upper()
            if "HX" in code or "HOMESTEAD" in desc or "HOMESTEAD" in code:
                homestead = True
                break
    elif isinstance(exemptions, dict):
        desc = str(exemptions).upper()
        homestead = "HOMESTEAD" in desc or "HX" in desc

    # Assessed value
    assess = data.get("AssessmentInfo") or data.get("Assessment") or {}
    assessed_value = 0
    for key in ("JustValue", "AssessedValue", "MarketValue", "just_value"):
        v = assess.get(key) or data.get(key)
        if v:
            try:
                assessed_value = int(float(str(v).replace(",", "")))
                break
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

            enriched_ids.add(lead["id"])
            status = "🏠 homestead" if info["homestead"] else "non-homestead"
            print(f"  [{i+1}/{len(to_enrich)}] {lead['propertyAddress'][:40]} — {status}")
        else:
            print(f"  [{i+1}/{len(to_enrich)}] {lead['propertyAddress'][:40]} — no PA data")

        if i < len(to_enrich) - 1:
            time.sleep(delay)

    print(f"  PA enrichment complete. Enriched: {len(enriched_ids)}/{len(to_enrich)}")
    return leads


if __name__ == "__main__":
    result = lookup_by_folio("01-4109-012-0450")
    print(result)
