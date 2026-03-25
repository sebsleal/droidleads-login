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
from datetime import datetime, timezone
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

_COUNTY_DISPLAY_NAMES = {
    "miami-dade": "Miami-Dade County",
    "broward":    "Broward County",
    "palm-beach": "Palm Beach County",
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


def _normalize_location_name(value: str) -> str:
    value = (value or "").strip()
    if not value or value.upper() in {"UNKNOWN", "UNKN", "UNK"}:
        return ""
    return value.title()


def _build_location_label(row: dict[str, str], county_slug: str, city: str) -> str:
    cz_name = (row.get("CZ_NAME") or "").strip().title()
    if city and cz_name:
        if city.lower() in cz_name.lower():
            return cz_name
        return f"{city} area ({cz_name})"
    if cz_name:
        return cz_name
    return _COUNTY_DISPLAY_NAMES[county_slug]


def _build_event_label(row: dict[str, str], event_type: str, event_date: str) -> str:
    storm_name = (row.get("EVENT_NAME") or "").strip()
    if storm_name:
        return storm_name.title()
    return f"{event_type} ({event_date[:7]})"


def _parse_damage_amount(raw: str) -> float:
    raw = (raw or "").strip().upper()
    if not raw:
        return 0.0

    try:
        if raw.endswith("K"):
            return float(raw[:-1]) * 1_000
        if raw.endswith("M"):
            return float(raw[:-1]) * 1_000_000
        if raw.endswith("B"):
            return float(raw[:-1]) * 1_000_000_000
        return float(raw)
    except ValueError:
        return 0.0


def _parse_float(raw: str) -> float | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _parse_int(raw: str) -> int:
    raw = (raw or "").strip()
    if not raw:
        return 0
    try:
        return int(raw)
    except ValueError:
        try:
            return int(float(raw))
        except ValueError:
            return 0


def scrape_storm_records(
    years: list[int] | None = None,
    max_age_days: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return normalized NOAA storm-event records for South Florida.

    These records are area-level event inputs, not permit leads.
    """
    if years is None:
        years = [2024, 2025]

    urls = get_available_years(years)
    if not urls:
        print("[storms] No NOAA files found for requested years")
        return []

    now = datetime.now(timezone.utc).date()
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

            event_date = parse_event_date(row)
            if max_age_days is not None:
                try:
                    age_days = (now - datetime.fromisoformat(event_date).date()).days
                    if age_days > max_age_days:
                        continue
                except ValueError:
                    continue

            county_slug = get_county_slug(row)
            city = _normalize_location_name(row.get("BEGIN_LOCATION") or row.get("END_LOCATION") or "")
            location_label = _build_location_label(row, county_slug, city)
            narrative = (row.get("EVENT_NARRATIVE") or "").strip()
            episode_narrative = (row.get("EPISODE_NARRATIVE") or "").strip()

            direct_deaths = _parse_int(row.get("DEATHS_DIRECT") or "0")
            indirect_deaths = _parse_int(row.get("DEATHS_INDIRECT") or "0")
            direct_injuries = _parse_int(row.get("INJURIES_DIRECT") or "0")
            indirect_injuries = _parse_int(row.get("INJURIES_INDIRECT") or "0")

            results.append({
                "county": county_slug,
                "city": city,
                "zip": "",
                "location_label": location_label,
                "storm_event": _build_event_label(row, event_type, event_date),
                "event_type": event_type,
                "event_date": event_date,
                "narrative": narrative or episode_narrative,
                "episode_narrative": episode_narrative,
                "source": "NOAA Storm Events",
                "noaa_episode_id": row.get("EPISODE_ID") or "",
                "noaa_event_id": row.get("EVENT_ID") or "",
                "cz_name": (row.get("CZ_NAME") or "").strip().title(),
                "property_damage": _parse_damage_amount(row.get("DAMAGE_PROPERTY") or ""),
                "crop_damage": _parse_damage_amount(row.get("DAMAGE_CROPS") or ""),
                "deaths": direct_deaths + indirect_deaths,
                "injuries": direct_injuries + indirect_injuries,
                "magnitude": _parse_float(row.get("MAGNITUDE") or ""),
                "magnitude_type": (row.get("MAGNITUDE_TYPE") or "").strip(),
                "tor_f_scale": (row.get("TOR_F_SCALE") or "").strip(),
            })

            county_counts[county_slug] = county_counts.get(county_slug, 0) + 1

    total = len(results)
    breakdown = ", ".join(f"{county}: {count}" for county, count in sorted(county_counts.items()))
    print(f"[storms] Total normalized South FL storm records: {total} ({breakdown})")
    return results


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
    records = scrape_storm_records(years=years)
    results: list[dict[str, Any]] = []

    for record in records:
        county_slug = record["county"]
        default_city = _COUNTY_CITY_DEFAULTS[county_slug]
        default_zip = _COUNTY_ZIP_DEFAULTS[county_slug]
        event_type = record["event_type"]

        damage_type = "Hurricane/Wind"
        if "Flood" in event_type or "Surge" in event_type or "Rain" in event_type:
            damage_type = "Flood"
        elif "Fire" in event_type:
            damage_type = "Fire"

        results.append({
            "owner_name": "Property Owner",
            "address": f"{record['location_label']}, FL",
            "city": record["city"] or default_city,
            "zip": default_zip,
            "folio_number": "",
            "damage_type": damage_type,
            "permit_type": f"Storm Event - {event_type}",
            "permit_date": record["event_date"],
            "storm_event": record["storm_event"],
            "source": "storm",
            "status": "New",
            "contact_email": None,
            "contact_phone": None,
            "county": county_slug,
            "noaa_episode_id": record["noaa_episode_id"],
            "noaa_event_id": record["noaa_event_id"],
            "narrative": record["narrative"],
        })

    total = len(results)
    print(f"[storms] Total South FL storm events: {total}")
    return results


if __name__ == "__main__":
    events = scrape_storm_events([2024, 2025])
    for e in events[:5]:
        print(e)
