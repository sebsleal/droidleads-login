"""
Florida Sunbiz (Division of Corporations) lookup for LLC/corporate-owned properties.

When a property's owner name contains "LLC", "INC", "CORP", "LTD", "TRUST", etc.,
the owner is likely a business entity. Sunbiz provides:
  - Registered agent name + address + phone
  - Principal address
  - Officer/director names and titles

This is a web scraper (no official API) — use respectfully with delays.

Sunbiz search URL: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults
"""

import html as html_module
import re
import time
import requests
from typing import Any

SUNBIZ_SEARCH_URL = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults"
SUNBIZ_DETAIL_BASE = "https://search.sunbiz.org"

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


def _strip_tags(html: str) -> str:
    """Remove HTML tags and decode entities."""
    return html_module.unescape(re.sub(r"<[^>]+>", "", html)).strip()


def _extract_detail_url(html: str) -> str | None:
    """Extract the first result's detail page URL from search results HTML."""
    match = re.search(
        r'href="(/Inquiry/CorporationSearch/SearchResultDetail\?[^"]+)"',
        html,
    )
    if match:
        return SUNBIZ_DETAIL_BASE + html_module.unescape(match.group(1))
    return None


def _parse_detail_page(html: str) -> dict[str, Any]:
    """
    Parse a Sunbiz entity detail page to extract:
      - Registered agent name, address, phone
      - Officer/director names and titles

    Returns a dict with keys:
      registered_agent_name, registered_agent_address, registered_agent_phone,
      officers: list of {name, title, address}
    """
    result: dict[str, Any] = {
        "registered_agent_name": None,
        "registered_agent_address": None,
        "registered_agent_phone": None,
        "officers": [],
    }

    # --- Registered agent ---
    # Sunbiz detail pages typically have a section like:
    # <span class="label">Registered Agent Name &amp; Address</span>
    # followed by spans with class "field" for name, address lines
    # Try span-based layout first
    ra_section = re.search(
        r'Registered Agent Name.*?(?=Officer/Director|Principal Address|$)',
        html, re.DOTALL | re.IGNORECASE,
    )
    if ra_section:
        ra_html = ra_section.group(0)
        # Extract name (first <span class="field"> or <td> after the label)
        name_m = re.search(r'<span[^>]*class="field"[^>]*>(.*?)</span>', ra_html, re.DOTALL)
        if name_m:
            result["registered_agent_name"] = _strip_tags(name_m.group(1))
        # Extract address (next field span)
        addr_m = re.search(
            r'<span[^>]*class="field"[^>]*>.*?</span>.*?<span[^>]*class="field"[^>]*>(.*?)</span>',
            ra_html, re.DOTALL
        )
        if addr_m:
            result["registered_agent_address"] = _strip_tags(addr_m.group(1))
        # Phone number anywhere in RA section
        phone_m = re.search(r'(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})', ra_html)
        if phone_m:
            result["registered_agent_phone"] = phone_m.group(1).strip()

    # Fallback for table-based layout
    if not result["registered_agent_name"]:
        ra_td = re.search(
            r'Registered Agent Name.*?<td[^>]*>(.*?)</td>',
            html, re.DOTALL | re.IGNORECASE
        )
        if ra_td:
            result["registered_agent_name"] = _strip_tags(ra_td.group(1))

    # --- Officers / Directors ---
    # Sunbiz officer section looks like:
    # <th colspan="5">Officer/Director Detail</th>
    # followed by rows of Name / Title / Address
    officer_section = re.search(
        r'Officer/Director Detail(.*?)(?:<th[^>]*>|</table>|$)',
        html, re.DOTALL | re.IGNORECASE,
    )
    if officer_section:
        officer_html = officer_section.group(1)
        # Each officer block has class="field" spans: name, title, address
        # They appear in triples: name, title, address (address may span multiple lines)
        field_values = re.findall(
            r'<span[^>]*class="field"[^>]*>(.*?)</span>',
            officer_html, re.DOTALL
        )
        # Group into (name, title, address) triples
        i = 0
        while i + 1 < len(field_values):
            name = _strip_tags(field_values[i])
            title = _strip_tags(field_values[i + 1]) if i + 1 < len(field_values) else ""
            address = _strip_tags(field_values[i + 2]) if i + 2 < len(field_values) else ""
            if name and len(name) > 2:
                result["officers"].append({
                    "name": name,
                    "title": title or "Officer",
                    "address": address or None,
                })
            i += 3

    # Fallback: officer names from table rows (tr > td patterns)
    if not result["officers"]:
        # Look for officer table rows after "Officer/Director Detail" heading
        officer_rows = re.findall(
            r'<tr[^>]*>\s*<td[^>]*>([^<]{3,50})</td>\s*<td[^>]*>([^<]{1,30})</td>',
            html[html.lower().find("officer"):] if "officer" in html.lower() else "",
            re.IGNORECASE
        )
        for name_raw, title_raw in officer_rows[:10]:
            name = _strip_tags(name_raw).strip()
            title = _strip_tags(title_raw).strip()
            # Filter out header rows
            if name.upper() in ("NAME", "TITLE", "ADDRESS", ""):
                continue
            if len(name) > 2:
                result["officers"].append({"name": name, "title": title or "Officer", "address": None})

    return result


def search_sunbiz(entity_name: str) -> dict[str, Any] | None:
    """
    Search Sunbiz for a Florida business entity by name.
    Fetches the detail page to return registered agent contact info
    and officer/director names.
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
        search_html = resp.text

        # Try to get detail page for richer data (officers, proper RA info)
        detail_url = _extract_detail_url(search_html)
        if detail_url:
            time.sleep(1)  # brief pause before detail fetch
            detail_resp = requests.get(detail_url, headers=HEADERS, timeout=15)
            detail_resp.raise_for_status()
            parsed = _parse_detail_page(detail_resp.text)
        else:
            # Fall back to parsing search results page directly
            parsed = _parse_detail_page(search_html)

        if not parsed["registered_agent_name"] and not parsed["officers"]:
            return None

        return parsed

    except Exception as e:
        print(f"[sunbiz] Search failed for '{entity_name}': {e}")
        return None


def enrich_business_owners(
    leads: list[dict[str, Any]],
    top_n: int = 20,
    delay: float = 2.0,
) -> list[dict[str, Any]]:
    """
    For leads owned by business entities, look up registered agent contact info
    and officer names via Sunbiz.

    Args:
        leads: List of lead dicts sorted by score descending.
        top_n: Max number of Sunbiz lookups (conservative — web scraping).
        delay: Seconds between requests (be respectful to Sunbiz servers).

    Returns:
        List of lead dicts with contact info and LLC officer data enriched.
    """
    enriched = 0
    lookups = 0

    for lead in leads[:top_n]:
        owner = lead.get("owner_name") or lead.get("ownerName") or ""
        if not is_business_entity(owner):
            continue

        existing_phone = lead.get("contact_phone") or (lead.get("contact") or {}).get("phone")
        # Skip if we already have both phone and officer data
        if existing_phone and lead.get("llc_officers"):
            continue

        print(f"[sunbiz] Looking up: {owner}")
        result = search_sunbiz(owner)
        lookups += 1

        if result:
            # Contact phone from registered agent
            if not existing_phone and result.get("registered_agent_phone"):
                lead["contact_phone"] = result["registered_agent_phone"]
                existing_email = lead.get("contact_email") or (lead.get("contact") or {}).get("email")
                lead["contact"] = {
                    "phone": result["registered_agent_phone"],
                    "email": existing_email,
                }
                print(f"[sunbiz] Found RA phone for {owner}: {result['registered_agent_phone']}")

            # Store registered agent info
            if result.get("registered_agent_name"):
                lead["registered_agent_name"] = result["registered_agent_name"]
            if result.get("registered_agent_address"):
                lead["registered_agent_address"] = result["registered_agent_address"]

            # Store officers/members
            if result.get("officers"):
                lead["llc_officers"] = result["officers"]
                print(f"[sunbiz] Found {len(result['officers'])} officer(s) for {owner}")

            enriched += 1

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
        print(f"{lead['owner_name']}: phone={lead.get('contact_phone')}, officers={lead.get('llc_officers')}")
