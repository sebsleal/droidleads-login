# Storm Watch

Storm Watch is a separate workflow from permit leads.

## What It Uses

- `public/storm_candidates.json` is generated from NOAA Storm Events plus FEMA declaration matching.
- The current MVP emits `candidateType: "area"` records only.
- Area-based records intentionally leave property-specific fields out instead of inventing owner or address data.

## How To Generate

- Run `python3 generate_storm_candidates.py` to rebuild `public/storm_candidates.json`.
- Run `python3 run_scraper.py` to refresh both `public/leads.json` and `public/storm_candidates.json`.

## Matching And Scoring

- NOAA events are normalized from `scrapers/storms.py` for Miami-Dade, Broward, and Palm Beach.
- Events are grouped into county-level storm opportunities by county, NOAA episode, and event type.
- FEMA matching uses declaration incident dates, not permit windows.
- Scoring is deterministic and currently weights event severity, FEMA matching, recency, geographic spread, reported damage, casualties, narrative signals, and magnitude.

## Tracking

- Storm Watch tracking persists separately in the `storm_tracking` table.
- If Supabase environment variables are missing, the UI falls back to local optimistic state only.
