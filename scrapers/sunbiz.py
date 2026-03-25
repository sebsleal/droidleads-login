"""
Florida Sunbiz (Division of Corporations) lookup for LLC/corporate-owned properties.

When a property's owner name contains "LLC", "INC", "CORP", "LTD", "TRUST", etc.,
the owner is likely a business entity. Sunbiz provides:
  - Registered agent name + address + phone
  - Principal address
  - Officer/director names

This is a web scraper (no official API) — use respectfully with delays.

Sunbiz search URL: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults
"""

import re
import time
import requests
from typing import Any

SUNBIZ_SEARCH_URL = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults"
SUNBIZ_DETAIL_URL = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Referer": "https://search.sunbiz.org/",
}

# Keywords that indicate a business entity (not a natural person)
ENTITY_KEYWORDS = [
    "LLC", "L.L.C", "INC", "CORP", "LTD", "TRUST", "HOLDINGS",
    "PROPERTIES", "REALTY", "INVESTMENTS", "GROUP", "PARTNERS", "VENTURES",
]


def is_business_entity(owner_name: str) -> bool:
    """Check if the owner name looks like a business entity."""
    name_upper = owner_name.upper()
    return any(kw in name_upper for kw in ENTITY_KEYWORDS)


def search_sunbiz(entity_name: str) -> dict[str, Any] | None:
    """
    Search Sunbiz for a Florida business entity by name.
    Returns the registered agent contact info if found.
    """
    # Clean up LLC suffix variations for search
    search_name = re.sub(r"\bL\.?L\.?C\.?\b", "LLC", entity_name, flags=re.IGNORECASE).strip()
    # Remove common suffixes to improve search hit rate
    for suffix in [" LLC", " INC", " CORP", " LTD"]:
        if search_name.upper().endswith(suffix):
            search_name = search_name[: -len(suffix)].strip()
            break

    params = {
        "SearchTerm": search_name,
        "SearchType": "EntityName",
        "SearchStatus": "Active",
        "ListPage": "1",
    }

    try:
        resp = requests.get(
            SUNBIZ_SEARCH_URL, params=params, headers=HEADERS, timeout=15
        )
        resp.raise_for_status()
        return _parse_search_results(resp.text, entity_name)
    except Exception as e:
        print(f"[sunbiz] Search failed for '{entity_name}': {e}")
        return None


def _parse_search_results(html: str, original_name: str) -> dict[str, Any] | None:
    """
    Parse Sunbiz search results HTML to extract registered agent info.
    Returns first matching result's contact info, or None.
    """
    # Look for entity detail links
    entity_id_match = re.search(r'inquirytype=EntityName.*?docNumber=([A-Z0-9]+)', html)
    if not entity_id_match:
        # Try alternate pattern
        detail_match = re.search(r'/Detail\?inquirytype=EntityName&directionType=&searchNameOrder=.*?&documentNumber=([A-Z0-9]+)', html)
        if not detail_match:
            return None

    # Extract registered agent info from the search results page directly
    # Look for "Registered Agent" section
    ra_phone_match = re.search(
        r'Registered Agent.*?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})',
        html, re.DOTALL | re.IGNORECASE
    )
    ra_name_match = re.search(
        r'Registered Agent Name.*?<td[^>]*>(.*?)</td>',
        html, re.DOTALL | re.IGNORECASE
    )
    ra_addr_match = re.search(
        r'Registered Agent Address.*?<td[^>]*>(.*?)</td>',
        html, re.DOTALL | re.IGNORECASE
    )

    phone = ra_phone_match.group(1).strip() if ra_phone_match else None
    name = re.sub(r'<[^>]+>', '', ra_name_match.group(1)).strip() if ra_name_match else None
    address = re.sub(r'<[^>]+>', '', ra_addr_match.group(1)).strip() if ra_addr_match else None

    if not phone and not name:
        return None

    return {
        "registered_agent_name": name,
        "registered_agent_address": address,
        "registered_agent_phone": phone,
    }


def enrich_business_owners(
    leads: list[dict[str, Any]],
    top_n: int = 20,
    delay: float = 2.0,
) -> list[dict[str, Any]]:
    """
    For leads owned by business entities, look up registered agent contact info
    via Sunbiz. This is a fallback for leads with no other contact info.

    Args:
        leads: List of lead dicts sorted by score descending.
        top_n: Max number of Sunbiz lookups (conservative — web scraping).
        delay: Seconds between requests (be respectful to Sunbiz servers).

    Returns:
        List of lead dicts with contact info enriched where found.
    """
    enriched = 0
    lookups = 0

    for lead in leads[:top_n]:
        owner = lead.get("owner_name") or lead.get("ownerName") or ""
        if not is_business_entity(owner):
            continue

        # Skip if already has phone contact; allow filling phone if only email exists
        existing_phone = lead.get("contact_phone") or (lead.get("contact") or {}).get("phone")
        existing_email = lead.get("contact_email") or (lead.get("contact") or {}).get("email")
        if existing_phone:
            continue

        print(f"[sunbiz] Looking up: {owner}")
        result = search_sunbiz(owner)
        lookups += 1

        if result and result.get("registered_agent_phone"):
            lead["contact_phone"] = result["registered_agent_phone"]
            contact_email = existing_email or (lead.get("contact") or {}).get("email")
            lead["contact"] = {"phone": result["registered_agent_phone"], "email": contact_email}
            # Store registered agent name for context
            if result.get("registered_agent_name"):
                lead["registeredAgentName"] = result["registered_agent_name"]
            enriched += 1
            print(f"[sunbiz] Found contact for {owner}: {result['registered_agent_phone']}")

        if lookups < top_n:
            time.sleep(delay)

    print(f"[sunbiz] Enrichment complete: {enriched}/{lookups} business entities matched")
    return leads


if __name__ == "__main__":
    test_leads = [
        {"owner_name": "Palmetto Bay Holdings LLC", "address": "14500 SW 104th Ave", "contact_phone": None},
        {"owner_name": "John Smith", "address": "1427 SW 8th St", "contact_phone": None},
    ]
    result = enrich_business_owners(test_leads)
    for lead in result:
        print(f"{lead['owner_name']}: {lead.get('contact_phone')}")
