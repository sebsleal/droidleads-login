"""
Master scraper runner for Railway deployment.

Pipeline:
  1. Fetch building permits for all enabled counties (scrapers/permits.py)
  2. Fetch NOAA storm events — now covers Miami-Dade, Broward, Palm Beach
  2b. Fetch FEMA disaster declarations + build claim windows (scrapers/fema.py)
  2c. Pre-permit parcel scan — storm-first leads for properties with no permit yet
  2d. FEMA enrichment — tag each lead with matching declaration
  3. Enrich with PA owner info (scrapers/property.py)
  4. Deduplicate (scrapers/dedup.py)
  5. Algorithmic pre-scoring
  6. Contact enrichment (voter roll + Sunbiz) for top leads
  7. Insert / upsert to Supabase (db/insert.py)
  8. Regenerate public/leads.json with TEMPLATE: outreach placeholders
     and public/storm_candidates.json for Storm Watch
     (Codex / ChatGPT automation fills lead outreach placeholders via enrich_leads.py)

Scheduled via Railway cron: 0 */6 * * * (every 6 hours)
"""

import os
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()


def banner(step: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'='*60}")
    print(f"  {step}")
    print(f"  {ts}")
    print(f"{'='*60}")


def run() -> int:
    start = time.time()
    banner("Claim Remedy Adjusters — Scraper Pipeline Starting")

    # -------------------------------------------------------------------
    # 1. Scrape permits — loop over all enabled counties
    # -------------------------------------------------------------------
    banner("Step 1: Multi-County Permits")
    permit_leads: list[dict] = []
    try:
        from scrapers.permits import COUNTY_CONFIGS, scrape_damage_permits

        for county, cfg in COUNTY_CONFIGS.items():
            if not cfg.get("enabled"):
                print(f"[run] Permits: skipping '{county}' (disabled)")
                continue
            try:
                leads = scrape_damage_permits(county=county, max_records=500)
                permit_leads.extend(leads)
                print(f"[run] {county}: {len(leads)} permit leads")
            except Exception as e:
                print(f"[run] Permits scraper failed for '{county}': {e}")

        print(f"[run] Total permit leads: {len(permit_leads)}")
    except Exception as e:
        print(f"[run] Permits module import failed: {e}")
        permit_leads = []

    # -------------------------------------------------------------------
    # 2. Scrape NOAA storm events (Miami-Dade + Broward + Palm Beach)
    # -------------------------------------------------------------------
    banner("Step 2: NOAA Storm Events (South Florida)")
    storm_leads: list[dict] = []
    try:
        from scrapers.storms import scrape_storm_events
        current_year = datetime.now(timezone.utc).year
        storm_leads = scrape_storm_events(years=[current_year - 1, current_year])
        print(f"[run] Storm events scraped: {len(storm_leads)}")
    except Exception as e:
        print(f"[run] Storms scraper failed: {e}")
        storm_leads = []

    # -------------------------------------------------------------------
    # 2b. FEMA disaster declarations — build claim windows for enrichment
    # -------------------------------------------------------------------
    banner("Step 2b: FEMA Disaster Declarations")
    fema_windows: list[dict] = []
    try:
        from scrapers.fema import fetch_fl_declarations, build_fema_windows
        declarations = fetch_fl_declarations(lookback_years=3)
        fema_windows = build_fema_windows(declarations)
        print(f"[run] FEMA: {len(fema_windows)} active declaration windows loaded")
    except Exception as e:
        print(f"[run] FEMA fetch failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 2c. Pre-Permit parcel scan — storm-first leads (no permit filed yet)
    # -------------------------------------------------------------------
    banner("Step 2c: Pre-Permit Parcel Scan (Storm-First)")
    pre_permit_leads: list[dict] = []
    try:
        from scrapers.parcels import fetch_parcels_by_zip, MIAMI_DADE_ZIPS

        # Only scan if we have recent Miami-Dade storm events
        mdc_storms = [l for l in storm_leads if l.get("county") == "miami-dade"]
        if mdc_storms:
            # Pick the most recent storm event label + damage type for tagging
            latest_storm = max(mdc_storms, key=lambda l: l.get("permitDate", ""))
            storm_label = latest_storm.get("stormEvent", "")
            storm_damage = latest_storm.get("damageType", "Hurricane/Wind")

            # Existing permit addresses — used to exclude already-filed properties
            existing_addresses = {
                l.get("propertyAddress", "").lower().strip()
                for l in permit_leads
                if l.get("propertyAddress")
            }

            # Sample ZIP codes (parcels.py hard-caps at 5 per run)
            sample_zips = MIAMI_DADE_ZIPS[:5]
            parcels = fetch_parcels_by_zip(sample_zips, limit_per_zip=20)

            today = datetime.now(timezone.utc).date().isoformat()
            for p in parcels:
                addr = (p.get("propertyAddress") or "").lower().strip()
                if not addr or addr in existing_addresses:
                    continue  # skip already-permitted properties
                pre_permit_leads.append({
                    "source": "storm-first",
                    "propertyAddress": p.get("propertyAddress", ""),
                    "city": "Miami",
                    "zip": p.get("zip", "33101"),
                    "folioNumber": p.get("folioNumber", ""),
                    "county": "miami-dade",
                    "damageType": storm_damage,
                    "permitType": "Pre-Permit",
                    "permitDate": today,
                    "stormEvent": storm_label,
                    "ownerName": "Property Owner",
                    "score": 0,
                })
            print(f"[run] Pre-permit leads generated: {len(pre_permit_leads)}")
        else:
            print("[run] No recent Miami-Dade storm events — skipping parcel scan")
    except Exception as e:
        print(f"[run] Pre-permit parcel scan failed (non-fatal): {e}")

    all_leads = permit_leads + storm_leads + pre_permit_leads
    print(f"[run] Total raw leads: {len(all_leads)}")

    if not all_leads:
        print("[run] No leads scraped — exiting early")
        return 1

    # -------------------------------------------------------------------
    # 2d. FEMA enrichment — tag each lead with matching declaration
    # -------------------------------------------------------------------
    if fema_windows:
        try:
            from scrapers.fema import match_fema
            fema_enriched = 0
            for lead in all_leads:
                m = match_fema(
                    lead.get("permit_date", ""),
                    lead.get("county", "miami-dade"),
                    fema_windows,
                )
                if m:
                    lead["fema_declaration_number"] = m["fema_number"]
                    lead["fema_incident_type"]      = m["incident_type"]
                    # Only set storm_event from FEMA if not already tagged
                    if not lead.get("storm_event"):
                        lead["storm_event"] = m["label"]
                    fema_enriched += 1
            print(f"[run] FEMA: enriched {fema_enriched} leads with declaration data")
        except Exception as e:
            print(f"[run] FEMA enrichment failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 3. Enrich with PA owner info (top 100 leads by position)
    # -------------------------------------------------------------------
    banner("Step 3: Property Appraiser Owner Lookup")
    try:
        from scrapers.property import enrich_leads_with_owner_info
        all_leads = enrich_leads_with_owner_info(all_leads, max_lookups=100)
        print(f"[run] Owner info enrichment complete")
    except Exception as e:
        print(f"[run] Property lookup failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 4. Deduplicate
    # -------------------------------------------------------------------
    banner("Step 4: Deduplication")
    try:
        from scrapers.dedup import deduplicate_leads, get_existing_hashes_from_db

        # Fetch existing hashes from DB to skip already-known leads
        try:
            from db.insert import get_client
            supabase = get_client()
            existing_hashes = get_existing_hashes_from_db(supabase)
            print(f"[run] Found {len(existing_hashes)} existing hashes in DB")
        except Exception as e:
            print(f"[run] Could not fetch existing hashes (will dedup batch only): {e}")
            existing_hashes = set()
            supabase = None

        unique_leads, _ = deduplicate_leads(all_leads, seen_hashes=existing_hashes)
        print(f"[run] Unique new leads: {len(unique_leads)}")
    except Exception as e:
        print(f"[run] Dedup failed: {e}")
        return 1

    if not unique_leads:
        print("[run] No new leads after dedup — exiting")
        return 0

    # -------------------------------------------------------------------
    # 5. Score leads (algorithmic pre-score before Claude enrichment)
    # -------------------------------------------------------------------
    banner("Step 5: Algorithmic Pre-Scoring")
    try:
        from enrichment.score_prompt import _algorithmic_score
        for lead in unique_leads:
            lead["score"] = _algorithmic_score(lead)
        print(f"[run] Pre-scored {len(unique_leads)} leads")
    except Exception as e:
        print(f"[run] Pre-scoring failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 6. Contact enrichment (voter roll + Sunbiz)
    # -------------------------------------------------------------------
    banner("Step 6: Contact Enrichment")
    try:
        from scrapers.sunbiz import enrich_business_owners
        from scrapers.voter_lookup import enrich_with_voter_data
        from enrichment.score_prompt import _algorithmic_score

        unique_leads.sort(key=lambda l: l.get("score", 0), reverse=True)
        unique_leads = enrich_business_owners(unique_leads, top_n=20, delay=2.0)
        unique_leads = enrich_with_voter_data(unique_leads, top_n=100)

        # Refresh pre-scores now that contact info may exist
        for lead in unique_leads:
            lead["score"] = _algorithmic_score(lead)

        print("[run] Contact enrichment complete")
    except Exception as e:
        print(f"[run] Contact enrichment failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 7. Insert to Supabase
    # -------------------------------------------------------------------
    banner("Step 7: Upsert to Supabase")
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
        print("[run] SUPABASE_URL/KEY not set — skipping DB upsert (non-fatal)")
    else:
        try:
            from db.insert import upsert_leads
            result = upsert_leads(unique_leads, supabase=supabase)
            print(f"[run] DB upsert result: {result}")
        except Exception as e:
            print(f"[run] DB upsert failed (non-fatal): {e}")

    # -------------------------------------------------------------------
    # 8. Regenerate public/leads.json and public/storm_candidates.json
    #    Outreach messages are written as TEMPLATE: placeholders in leads.json.
    #    Codex / ChatGPT automation (enrich_leads.py) fills those in via the IDE.
    # -------------------------------------------------------------------
    banner("Step 8: Regenerate dashboard datasets")
    try:
        import subprocess
        result_proc = subprocess.run(
            [sys.executable, "generate_leads.py"],
            capture_output=True,
            text=True,
        )
        if result_proc.returncode == 0:
            print("[run] leads.json regenerated successfully")
        else:
            print(f"[run] generate_leads.py exited {result_proc.returncode}")
            if result_proc.stderr:
                print(result_proc.stderr[:500])

        storm_proc = subprocess.run(
            [sys.executable, "generate_storm_candidates.py"],
            capture_output=True,
            text=True,
        )
        if storm_proc.returncode == 0:
            print("[run] storm_candidates.json regenerated successfully")
        else:
            print(f"[run] generate_storm_candidates.py exited {storm_proc.returncode}")
            if storm_proc.stderr:
                print(storm_proc.stderr[:500])
    except Exception as e:
        print(f"[run] Dataset regeneration failed (non-fatal): {e}")

    elapsed = time.time() - start

    # County breakdown summary
    county_counts: dict[str, int] = {}
    for lead in unique_leads:
        c = lead.get("county", "miami-dade")
        county_counts[c] = county_counts.get(c, 0) + 1
    fema_tagged = sum(1 for l in unique_leads if l.get("fema_declaration_number"))

    banner(f"Pipeline Complete in {elapsed:.1f}s")
    print(f"[run] Summary:")
    print(f"  Permit leads scraped:  {len(permit_leads)}")
    print(f"  Storm leads scraped:   {len(storm_leads)}")
    print(f"  Pre-permit leads:      {len(pre_permit_leads)}")
    print(f"  Unique new leads:      {len(unique_leads)}")
    print(f"  FEMA-tagged leads:     {fema_tagged}")
    for county, count in sorted(county_counts.items()):
        print(f"  {county}: {count} leads")

    return 0


if __name__ == "__main__":
    sys.exit(run())
