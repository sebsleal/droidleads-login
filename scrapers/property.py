"""
Miami-Dade Property Appraiser lookup.

Given a folio number, queries the Miami-Dade PA search proxy to retrieve
owner name and mailing address.

PA search proxy: https://www.miamidade.gov/apps/PA/paSearchProxy.aspx
"""

import re
import requests
from typing import Any

PA_SEARCH_URL = "https://www.miamidade.gov/apps/PA/paSearchProxy.aspx"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ClaimRemedyScraper/1.0; "
        "+https://claimremedy.com)"
    ),
    "Accept": "application/json, text/html, */*",
}


def lookup_by_folio(folio_number: str) -> dict[str, Any] | None:
    """
    Look up property owner info from Miami-Dade Property Appraiser.

    Args:
        folio_number: Miami-Dade folio number (e.g. "01-4109-012-0450").

    Returns:
        Dict with keys: owner_name, mailing_address, city, state, zip
        or None if not found / request failed.
    """
    # Normalise folio: strip dashes for the API
    folio_clean = folio_number.replace("-", "").strip()

    params = {
        "ptxApplication": "pSearch",
        "pSearchType": "folio",
        "pSiteAddress": "",
        "pUnit": "",
        "pFolioNumber": folio_clean,
        "pOwnerName": "",
        "pSubdivisionName": "",
        "pPropertyType": "",
        "pBuildingType": "",
        "pStreetName": "",
        "pStreetSuffix": "",
        "pStreetType": "",
        "pStreetDirection": "",
        "pCity": "",
        "pZip": "",
        "typeRollYear": "current",
    }

    try:
        resp = requests.get(
            PA_SEARCH_URL,
            params=params,
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[property] Request failed for folio {folio_number}: {e}")
        return None
    except ValueError:
        # Not JSON — try parsing HTML response
        return _parse_html_response(resp.text, folio_number)

    return _parse_json_response(data, folio_number)


def _parse_json_response(data: Any, folio_number: str) -> dict[str, Any] | None:
    """Parse a JSON response from the PA proxy."""
    if not isinstance(data, dict):
        return None

    # The PA API can return results in various shapes; try common keys
    owner = (
        data.get("Owner")
        or data.get("OwnerName")
        or data.get("owner_name")
        or ""
    )
    address = (
        data.get("MailingAddress")
        or data.get("Situs")
        or data.get("address")
        or ""
    )
    city = data.get("MailingCity") or data.get("city") or "Miami"
    state = data.get("MailingState") or data.get("state") or "FL"
    zip_code = data.get("MailingZip") or data.get("zip") or ""

    if not owner:
        return None

    return {
        "owner_name": str(owner).strip().title(),
        "mailing_address": str(address).strip(),
        "city": str(city).strip(),
        "state": str(state).strip(),
        "zip": str(zip_code).strip()[:5],
        "folio_number": folio_number,
    }


def _parse_html_response(html: str, folio_number: str) -> dict[str, Any] | None:
    """
    Fallback HTML parser for the PA proxy when JSON is not returned.
    Looks for owner name and address in the page markup.
    """
    owner_match = re.search(
        r'(?:owner|Owner)[^>]*>\s*<[^>]+>\s*([A-Z][A-Z ,&.\']+)',
        html,
    )
    address_match = re.search(
        r'(?:mailing|Mailing)[^>]*>.*?(\d+[^<]{5,50})',
        html,
        re.DOTALL,
    )

    if not owner_match:
        return None

    return {
        "owner_name": owner_match.group(1).strip().title(),
        "mailing_address": address_match.group(1).strip() if address_match else "",
        "city": "Miami",
        "state": "FL",
        "zip": "",
        "folio_number": folio_number,
    }


def enrich_leads_with_owner_info(
    leads: list[dict[str, Any]],
    max_lookups: int = 50,
) -> list[dict[str, Any]]:
    """
    Enrich a list of lead dicts with owner info from the PA.
    Only processes leads that have a folio number and missing owner_name.

    Args:
        leads: List of lead dicts.
        max_lookups: Maximum number of PA lookups to perform (rate-limit guard).

    Returns:
        Updated list of lead dicts with owner info filled in where found.
    """
    lookups_done = 0
    enriched: list[dict[str, Any]] = []

    for lead in leads:
        folio = lead.get("folio_number", "").strip()
        needs_lookup = (
            folio
            and (not lead.get("owner_name") or lead.get("owner_name") == "Property Owner")
            and lookups_done < max_lookups
        )

        if needs_lookup:
            info = lookup_by_folio(folio)
            if info:
                lead = {
                    **lead,
                    "owner_name": info["owner_name"],
                }
            lookups_done += 1

        enriched.append(lead)

    print(f"[property] Completed {lookups_done} PA lookups")
    return enriched


if __name__ == "__main__":
    # Quick test with a known folio
    result = lookup_by_folio("01-4109-012-0450")
    print(result)
