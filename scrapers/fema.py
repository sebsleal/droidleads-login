"""
FEMA Disaster Declarations scraper.

API: https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries
Free, no authentication required.

Provides:
  - fetch_fl_declarations()  — pull FL disaster declarations from FEMA API
  - build_fema_windows()     — convert declarations into 365-day claim windows
  - match_fema()             — match a permit date + county to a FEMA window

Usage:
    from scrapers.fema import fetch_fl_declarations, build_fema_windows, match_fema
    declarations = fetch_fl_declarations(lookback_years=3)
    windows = build_fema_windows(declarations)
    match = match_fema("2025-10-15", "miami-dade", windows)
    if match:
        lead["fema_declaration_number"] = match["fema_number"]
        lead["fema_incident_type"]      = match["incident_type"]
"""

import requests
from datetime import datetime, timedelta, timezone
from typing import Any

FEMA_API_URL = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"

# Maps FEMA designatedArea strings (uppercase) → our county slugs
FEMA_COUNTY_MAP: dict[str, str] = {
    "MIAMI-DADE": "miami-dade",
    "DADE":        "miami-dade",
    "BROWARD":     "broward",
    "PALM BEACH":  "palm-beach",
}

# State-wide declarations apply to all three counties
STATEWIDE_SLUG = "statewide"


def _parse_fema_date(date_str: str | None) -> datetime | None:
    """Parse an ISO-8601 date string from FEMA API into a datetime (UTC)."""
    if not date_str:
        return None
    # FEMA returns e.g. "2024-10-09T00:00:00.000Z"
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str[:26].rstrip("Z"), fmt.rstrip("Z"))
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def fetch_fl_declarations(lookback_years: int = 3) -> list[dict[str, Any]]:
    """
    Fetch Florida disaster declarations from the FEMA OpenFEMA API.

    Args:
        lookback_years: How many years back to pull declarations.

    Returns:
        List of declaration dicts with keys:
          fema_number, title, incident_type, county_slug,
          begin_date (datetime | None), end_date (datetime | None),
          declaration_date (datetime | None)
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_years * 365)
    cutoff_str = cutoff.strftime("%Y-%m-%dT00:00:00.000Z")

    params = {
        "$filter": f"state eq 'FL' and declarationDate ge '{cutoff_str}'",
        "$orderby": "declarationDate desc",
        "$top": 500,
        "$format": "json",
    }

    try:
        resp = requests.get(FEMA_API_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[fema] API fetch failed: {e}")
        return []
    except Exception as e:
        print(f"[fema] Unexpected error: {e}")
        return []

    raw_records = data.get("DisasterDeclarationsSummaries", [])
    results: list[dict[str, Any]] = []

    for rec in raw_records:
        designated_area = (rec.get("designatedArea") or "").upper().strip()
        # Remove trailing " (County)" suffix that FEMA sometimes adds
        for suffix in [" (COUNTY)", " COUNTY"]:
            if designated_area.endswith(suffix):
                designated_area = designated_area[: -len(suffix)].strip()

        county_slug = FEMA_COUNTY_MAP.get(designated_area, STATEWIDE_SLUG)

        disaster_number = rec.get("disasterNumber") or ""
        declaration_type = rec.get("declarationType") or ""
        fema_number = f"{declaration_type}-{disaster_number}" if declaration_type else str(disaster_number)

        results.append({
            "fema_number":      fema_number,
            "title":            rec.get("declarationTitle") or "",
            "incident_type":    rec.get("incidentType") or "",
            "county_slug":      county_slug,
            "begin_date":       _parse_fema_date(rec.get("incidentBeginDate")),
            "end_date":         _parse_fema_date(rec.get("incidentEndDate")),
            "declaration_date": _parse_fema_date(rec.get("declarationDate")),
        })

    print(f"[fema] Fetched {len(results)} FL declarations (lookback {lookback_years}y)")
    return results


def build_fema_windows(declarations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Build claim-filing windows from FEMA declarations.

    Florida's insurance claim filing window is 1 year after a disaster event.
    Window = incidentBeginDate  to  incidentBeginDate + 365 days.

    Returns list of window dicts:
      {label, fema_number, county_slug, incident_type, window_start, window_end}
    """
    windows: list[dict[str, Any]] = []

    for dec in declarations:
        begin = dec.get("begin_date")
        if not begin:
            # Fall back to declaration date if begin date missing
            begin = dec.get("declaration_date")
        if not begin:
            continue

        label = dec.get("title") or f"{dec['incident_type']} ({begin.strftime('%b %Y')})"

        windows.append({
            "label":        label,
            "fema_number":  dec["fema_number"],
            "county_slug":  dec["county_slug"],
            "incident_type": dec["incident_type"],
            "window_start": begin,
            "window_end":   begin + timedelta(days=365),
        })

    return windows


def match_fema(
    permit_date_str: str,
    county: str,
    windows: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """
    Return the best-matching FEMA window for a permit date + county, or None.

    Matching rules:
      1. Permit date must fall within [window_start, window_end].
      2. Window county_slug must match the lead's county, OR be 'statewide'.
      3. Among multiple matches, prefer the most recent window_start.

    Args:
        permit_date_str: ISO date string, e.g. "2025-10-15"
        county:          County slug, e.g. "miami-dade"
        windows:         Output of build_fema_windows()

    Returns:
        Matching window dict or None.
    """
    if not permit_date_str or not windows:
        return None

    try:
        permit_dt = datetime.fromisoformat(permit_date_str).replace(tzinfo=timezone.utc)
    except ValueError:
        return None

    candidates: list[dict[str, Any]] = []
    for w in windows:
        start = w["window_start"]
        end   = w["window_end"]
        if not (start <= permit_dt <= end):
            continue
        if w["county_slug"] != county and w["county_slug"] != STATEWIDE_SLUG:
            continue
        candidates.append(w)

    if not candidates:
        return None

    # Prefer county-specific over statewide; then prefer most recent start
    county_specific = [c for c in candidates if c["county_slug"] == county]
    pool = county_specific if county_specific else candidates
    return max(pool, key=lambda w: w["window_start"])


if __name__ == "__main__":
    decls = fetch_fl_declarations(lookback_years=3)
    wins  = build_fema_windows(decls)
    print(f"Declarations: {len(decls)}, Windows: {len(wins)}")
    for w in wins[:5]:
        print(
            f"  {w['fema_number']} | {w['label']} | {w['county_slug']} | "
            f"{w['window_start'].date()} – {w['window_end'].date()}"
        )

    # Test a match
    test_match = match_fema("2025-10-15", "miami-dade", wins)
    print(f"\nTest match for 2025-10-15, miami-dade: {test_match}")
