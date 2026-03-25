"""
NOAA storm events scraper — South Florida (Miami-Dade, Broward, Palm Beach).

Downloads bulk CSV files from:
  https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/

Each file is named like:
  StormEvents_details-ftp_v1.0_dYYYY_cYYYYMMDD.csv.gz

This scraper fetches the directory listing, finds the relevant year files,
downloads and decompresses them, then filters for Florida / South Florida events.
"""

import csv
import gzip
import io
import re
import requests
from datetime import datetime
from typing import Any

NOAA_BASE_URL = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"

# Storm event types relevant to insurance claims
RELEVANT_EVENT_TYPES = {
    "Hurricane (Typhoon)",
    "Tropical Storm",
    "High Wind",
    "Thunderstorm Wind",
    "Flash Flood",
    "Flood",
    "Storm Surge/Tide",
    "Tornado",
    "Hail",
    "Lightning",
    "Wildfire",
    "Debris Flow",
    "Heavy Rain",
}

# Zone name fragments to match for each South Florida county
TARGET_ZONES = {"MIAMI-DADE", "DADE", "MIAMI", "BROWARD", "PALM BEACH"}

# County city defaults (used when building lead dicts)
_COUNTY_CITY_DEFAULTS = {
    "miami-dade": "Miami",
    "broward":    "Fort Lauderdale",
    "palm-beach": "West Palm Beach",
}

_COUNTY_ZIP_DEFAULTS = {
    "miami-dade": "33101",
    "broward":    "33301",
    "palm-beach": "33401",
}


def is_target_county(row: dict[str, str]) -> bool:
    """Check if a storm event row is for a South Florida county we cover."""
    cz_name = (row.get("CZ_NAME") or "").upper().strip()
    state   = (row.get("STATE") or "").upper().strip()
    if state != "FLORIDA":
        return False
    return any(zone in cz_name for zone in TARGET_ZONES)


def get_county_slug(row: dict[str, str]) -> str:
    """Map a CZ_NAME value to our county slug."""
    cz = (row.get("CZ_NAME") or "").upper()
    if "BROWARD" in cz:
        return "broward"
    if "PALM BEACH" in cz:
        return "palm-beach"
    return "miami-dade"


def get_available_years(years: list[int]) -> list[str]:
    """
    Fetch the directory listing from NOAA and return URLs for the requested years.
    """
    try:
        resp = requests.get(NOAA_BASE_URL, timeout=15)
        resp.raise_for_status()
        text = resp.text
    except requests.RequestException as e:
        print(f"[storms] Could not fetch NOAA directory listing: {e}")
        return []

    urls: list[str] = []
    for year in years:
        pattern = rf'StormEvents_details-ftp_v1\.0_d{year}_c\d+\.csv\.gz'
        matches = re.findall(pattern, text)
        if matches:
            # Take the most recent version (last match by convention)
            urls.append(NOAA_BASE_URL + matches[-1])

    return urls


def download_and_parse_storm_csv(url: str) -> list[dict[str, str]]:
    """
    Download a gzipped NOAA storm events CSV and return rows as dicts.
    """
    try:
        resp = requests.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        compressed = resp.content
        decompressed = gzip.decompress(compressed)
        text = decompressed.decode("latin-1")  # NOAA files use latin-1
        reader = csv.DictReader(io.StringIO(text))
        return list(reader)
    except Exception as e:
        print(f"[storms] Error downloading {url}: {e}")
        return []


def parse_event_date(row: dict[str, str]) -> str:
    """Parse BEGIN_DATE_TIME into an ISO date string."""
    raw = row.get("BEGIN_DATE_TIME") or ""
    for fmt in ("%d-%b-%y %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return datetime.today().date().isoformat()


def scrape_storm_events(years: list[int] | None = None) -> list[dict[str, Any]]:
    """
    Download NOAA storm event files for the given years, filter to South Florida
    (Miami-Dade, Broward, Palm Beach), and return normalised lead dicts.

    Each returned dict includes a 'county' field with the county slug.

    Args:
        years: List of years to scrape (defaults to [2024, 2025]).

    Returns:
        List of normalised storm event lead dicts.
    """
    if years is None:
        years = [2024, 2025]

    urls = get_available_years(years)
    if not urls:
        print("[storms] No NOAA files found for requested years")
        return []

    results: list[dict[str, Any]] = []
    county_counts: dict[str, int] = {}

    for url in urls:
        print(f"[storms] Downloading {url}")
        rows = download_and_parse_storm_csv(url)
        print(f"[storms] Loaded {len(rows)} rows from {url.split('/')[-1]}")

        for row in rows:
            event_type = (row.get("EVENT_TYPE") or "").strip()
            if event_type not in RELEVANT_EVENT_TYPES:
                continue

            if not is_target_county(row):
                continue

            county_slug = get_county_slug(row)
            default_city = _COUNTY_CITY_DEFAULTS[county_slug]
            default_zip  = _COUNTY_ZIP_DEFAULTS[county_slug]
            cz_name      = row.get("CZ_NAME", "")

            event_date = parse_event_date(row)
            episode_id = row.get("EPISODE_ID") or ""
            event_id   = row.get("EVENT_ID") or ""
            narrative  = (row.get("EVENT_NARRATIVE") or "").strip()
            episode_narrative = (row.get("EPISODE_NARRATIVE") or "").strip()
            storm_name = (row.get("EVENT_NAME") or "").strip()

            # Build a human-readable storm event label
            event_label = storm_name or f"{event_type} ({event_date[:7]})"

            damage_type = "Hurricane/Wind"
            if "Flood" in event_type or "Surge" in event_type or "Rain" in event_type:
                damage_type = "Flood"
            elif "Fire" in event_type:
                damage_type = "Fire"

            results.append({
                "owner_name": "Property Owner",
                "address": f"{cz_name.title()} County, FL (Storm Zone: {cz_name})",
                "city": default_city,
                "zip": default_zip,
                "folio_number": "",
                "damage_type": damage_type,
                "permit_type": f"Storm Event — {event_type}",
                "permit_date": event_date,
                "storm_event": event_label,
                "source": "storm",
                "status": "New",
                "contact_email": None,
                "contact_phone": None,
                "county": county_slug,
                "noaa_episode_id": episode_id,
                "noaa_event_id": event_id,
                "narrative": narrative or episode_narrative,
            })

            county_counts[county_slug] = county_counts.get(county_slug, 0) + 1

    total = len(results)
    breakdown = ", ".join(f"{c}: {n}" for c, n in sorted(county_counts.items()))
    print(f"[storms] Total South FL storm events: {total} ({breakdown})")
    return results


if __name__ == "__main__":
    events = scrape_storm_events([2024, 2025])
    for e in events[:5]:
        print(e)
