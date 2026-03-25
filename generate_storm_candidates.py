"""
generate_storm_candidates.py - Storm Watch dataset generator

Builds a separate area-first opportunity dataset for the dashboard's
Storm Watch workflow using:
  1. NOAA Storm Events data for Miami-Dade, Broward, and Palm Beach
  2. FEMA disaster declaration matching

Output:
  public/storm_candidates.json
"""

import hashlib
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from scrapers.fema import fetch_fl_declarations, match_fema_declaration
from scrapers.storms import scrape_storm_records

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "public", "storm_candidates.json")
LOOKBACK_DAYS = 365

COUNTY_LABELS = {
    "miami-dade": "Miami-Dade County",
    "broward": "Broward County",
    "palm-beach": "Palm Beach County",
}

SEVERITY_BONUS = {
    "Hurricane (Typhoon)": 24,
    "Tropical Storm": 20,
    "Storm Surge/Tide": 18,
    "Flood": 18,
    "Flash Flood": 18,
    "Tornado": 18,
    "Wildfire": 18,
    "High Wind": 16,
    "Thunderstorm Wind": 14,
    "Heavy Rain": 12,
    "Hail": 12,
    "Lightning": 10,
    "Debris Flow": 10,
}

WIND_EVENT_TYPES = {"Hurricane (Typhoon)", "Tropical Storm", "High Wind", "Thunderstorm Wind", "Tornado"}
WATER_EVENT_TYPES = {"Storm Surge/Tide", "Flood", "Flash Flood", "Heavy Rain"}


def make_id(*parts: str) -> str:
    raw = "|".join(parts)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def summarize_locations(county: str, location_labels: list[str]) -> tuple[str, str]:
    unique_labels = sorted({label for label in location_labels if label})
    if not unique_labels:
        return COUNTY_LABELS[county], ""
    if len(unique_labels) == 1:
        return unique_labels[0], ""
    return f"Multiple areas in {COUNTY_LABELS[county]}", ""


def summarize_city(cities: list[str]) -> str:
    unique_cities = sorted({city for city in cities if city})
    if len(unique_cities) == 1:
        return unique_cities[0]
    return ""


def combine_narratives(narratives: list[str]) -> str:
    unique_narratives = []
    seen = set()
    for narrative in narratives:
        narrative = narrative.strip()
        if not narrative or narrative in seen:
            continue
        seen.add(narrative)
        unique_narratives.append(narrative)
        if len(unique_narratives) == 2:
            break

    if not unique_narratives:
        return "NOAA did not provide a narrative for this grouped storm event."
    return "\n\n".join(unique_narratives)


def score_candidate(
    event_type: str,
    event_date: str,
    narrative: str,
    location_count: int,
    total_property_damage: float,
    max_magnitude: float | None,
    total_injuries: int,
    total_deaths: int,
    fema_match: dict[str, Any] | None,
    county: str,
) -> tuple[int, str]:
    score = 35
    reasons: list[str] = []

    severity_bonus = SEVERITY_BONUS.get(event_type, 10)
    score += severity_bonus
    reasons.append(f"{event_type} carries a {severity_bonus}-point severity weight.")

    if fema_match:
        fema_bonus = 18 if fema_match["county_slug"] == county else 14
        score += fema_bonus
        reasons.append(
            f"Matched FEMA declaration {fema_match['fema_number']} for {fema_match['incident_type']} (+{fema_bonus})."
        )

    days_ago = (datetime.now(timezone.utc).date() - datetime.fromisoformat(event_date).date()).days
    if days_ago <= 30:
        score += 12
        reasons.append("Event is within the last 30 days (+12).")
    elif days_ago <= 90:
        score += 8
        reasons.append("Event is within the last 90 days (+8).")
    elif days_ago <= 180:
        score += 4
        reasons.append("Event is within the last 180 days (+4).")

    if location_count >= 3:
        score += 8
        reasons.append("NOAA reported impacts across multiple county sub-areas (+8).")
    elif location_count == 2:
        score += 4
        reasons.append("NOAA reported impacts across more than one area (+4).")

    if total_property_damage >= 1_000_000:
        score += 12
        reasons.append("Reported property damage exceeded $1M (+12).")
    elif total_property_damage >= 100_000:
        score += 8
        reasons.append("Reported property damage exceeded $100K (+8).")
    elif total_property_damage >= 10_000:
        score += 4
        reasons.append("Reported property damage exceeded $10K (+4).")

    if total_injuries or total_deaths:
        casualty_bonus = min(10, total_injuries * 2 + total_deaths * 4)
        score += casualty_bonus
        reasons.append(f"NOAA recorded injuries or deaths tied to the event (+{casualty_bonus}).")

    narrative_lower = narrative.lower()
    if any(keyword in narrative_lower for keyword in ["home", "homes", "house", "residential", "neighborhood"]):
        score += 6
        reasons.append("Narrative mentions residential impact (+6).")
    if any(keyword in narrative_lower for keyword in ["roof", "shingle", "structure", "building"]):
        score += 6
        reasons.append("Narrative points to building or roof damage (+6).")
    if any(keyword in narrative_lower for keyword in ["flood", "water", "surge", "inundat"]):
        score += 5
        reasons.append("Narrative indicates water intrusion or flooding (+5).")
    if any(keyword in narrative_lower for keyword in ["widespread", "multiple", "several", "numerous"]):
        score += 4
        reasons.append("Narrative suggests broad impact across the service area (+4).")

    if max_magnitude is not None:
        if event_type in WIND_EVENT_TYPES and max_magnitude >= 74:
            score += 8
            reasons.append(f"Peak reported wind magnitude reached {max_magnitude:g} (+8).")
        elif event_type in WIND_EVENT_TYPES and max_magnitude >= 58:
            score += 5
            reasons.append(f"Peak reported wind magnitude reached {max_magnitude:g} (+5).")
        elif event_type in WATER_EVENT_TYPES and max_magnitude >= 4:
            score += 4
            reasons.append(f"Peak reported precipitation or surge magnitude reached {max_magnitude:g} (+4).")
        elif event_type == "Hail" and max_magnitude >= 1.5:
            score += 4
            reasons.append(f"Hail magnitude reached {max_magnitude:g} (+4).")

    return min(score, 100), " ".join(reasons)


def group_storm_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        group_key = (
            record["county"],
            record["noaa_episode_id"] or record["noaa_event_id"] or record["event_date"],
            record["event_type"],
        )
        groups[group_key].append(record)

    grouped: list[dict[str, Any]] = []
    for (county, episode_id, event_type), bucket in groups.items():
        bucket.sort(key=lambda row: row["event_date"])
        grouped.append({
            "county": county,
            "episode_id": episode_id,
            "event_type": event_type,
            "event_date": bucket[0]["event_date"],
            "location_labels": [row["location_label"] for row in bucket],
            "cities": [row["city"] for row in bucket],
            "narratives": [row["narrative"] or row.get("episode_narrative", "") for row in bucket],
            "property_damage": sum(row["property_damage"] for row in bucket),
            "crop_damage": sum(row["crop_damage"] for row in bucket),
            "injuries": sum(row["injuries"] for row in bucket),
            "deaths": sum(row["deaths"] for row in bucket),
            "max_magnitude": max((row["magnitude"] for row in bucket if row["magnitude"] is not None), default=None),
            "location_count": len({row["location_label"] for row in bucket if row["location_label"]}),
        })

    return grouped


def build_candidates(grouped_records: list[dict[str, Any]], declarations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for grouped in grouped_records:
        county = grouped["county"]
        location_label, zip_code = summarize_locations(county, grouped["location_labels"])
        city = summarize_city(grouped["cities"])
        narrative = combine_narratives(grouped["narratives"])
        fema_match = match_fema_declaration(grouped["event_date"], county, declarations)
        score, score_reasoning = score_candidate(
            event_type=grouped["event_type"],
            event_date=grouped["event_date"],
            narrative=narrative,
            location_count=grouped["location_count"],
            total_property_damage=grouped["property_damage"],
            max_magnitude=grouped["max_magnitude"],
            total_injuries=grouped["injuries"],
            total_deaths=grouped["deaths"],
            fema_match=fema_match,
            county=county,
        )

        storm_event = (
            fema_match["title"]
            if fema_match and fema_match.get("title")
            else f"{grouped['event_type']} impact in {COUNTY_LABELS[county]}"
        )

        candidates.append({
            "id": make_id(county, grouped["episode_id"], grouped["event_type"], grouped["event_date"]),
            "candidateType": "area",
            "county": county,
            "city": city,
            "zip": zip_code,
            "locationLabel": location_label,
            "stormEvent": storm_event,
            "eventType": grouped["event_type"],
            "eventDate": grouped["event_date"],
            "femaDeclarationNumber": fema_match["fema_number"] if fema_match else "",
            "femaIncidentType": fema_match["incident_type"] if fema_match else "",
            "narrative": narrative,
            "score": score,
            "scoreReasoning": score_reasoning,
            "status": "Watching",
            "notes": "",
            "source": "NOAA Storm Events + FEMA Disaster Declarations" if fema_match else "NOAA Storm Events",
        })

    candidates.sort(key=lambda candidate: (candidate["score"], candidate["eventDate"]), reverse=True)
    return candidates


def run() -> None:
    now = datetime.now(timezone.utc)
    print("Fetching NOAA storm records for Storm Watch...")
    storm_records = scrape_storm_records(
        years=[now.year - 1, now.year],
        max_age_days=LOOKBACK_DAYS,
    )
    print(f"  Loaded {len(storm_records)} normalized NOAA records.")

    print("Fetching FEMA declarations for Storm Watch...")
    declarations = fetch_fl_declarations(lookback_years=2)
    print(f"  Loaded {len(declarations)} FEMA declarations.")

    grouped_records = group_storm_records(storm_records)
    print(f"  Collapsed NOAA records into {len(grouped_records)} grouped storm opportunities.")

    candidates = build_candidates(grouped_records, declarations)
    output = {
        "candidates": candidates,
        "lastGenerated": now.isoformat(),
        "count": len(candidates),
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as handle:
        json.dump(output, handle, indent=2)

    print(f"Saved {len(candidates)} storm candidates to {OUTPUT_PATH}")


if __name__ == "__main__":
    run()
