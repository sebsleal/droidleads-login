"""
Master scraper runner for Railway deployment.

Pipeline:
  1. Fetch Miami-Dade permit data (scrapers/permits.py)
  2. Fetch NOAA storm events (scrapers/storms.py)
  3. Optionally enrich leads with owner info from PA (scrapers/property.py)
  4. Deduplicate (scrapers/dedup.py)
  5. Insert / upsert to Supabase (db/insert.py)
  6. Enrich new leads with Claude scoring + outreach (enrichment/enrich.py)

Scheduled via Railway cron: 0 6 * * * (6am UTC = 2am EST)
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
    # 1. Scrape Miami-Dade permits
    # -------------------------------------------------------------------
    banner("Step 1: Miami-Dade Permits")
    try:
        from scrapers.permits import scrape_damage_permits
        permit_leads = scrape_damage_permits(max_records=500)
        print(f"[run] Permits scraped: {len(permit_leads)}")
    except Exception as e:
        print(f"[run] Permits scraper failed: {e}")
        permit_leads = []

    # -------------------------------------------------------------------
    # 2. Scrape NOAA storm events
    # -------------------------------------------------------------------
    banner("Step 2: NOAA Storm Events")
    try:
        from scrapers.storms import scrape_storm_events
        storm_leads = scrape_storm_events(years=[2024, 2025])
        print(f"[run] Storm events scraped: {len(storm_leads)}")
    except Exception as e:
        print(f"[run] Storms scraper failed: {e}")
        storm_leads = []

    all_leads = permit_leads + storm_leads
    print(f"[run] Total raw leads: {len(all_leads)}")

    if not all_leads:
        print("[run] No leads scraped — exiting early")
        return 1

    # -------------------------------------------------------------------
    # 3. Optional: Enrich with PA owner info (skipped if too many leads
    #    to avoid rate-limiting the PA API)
    # -------------------------------------------------------------------
    if len(all_leads) <= 100:
        banner("Step 3: Property Appraiser Owner Lookup")
        try:
            from scrapers.property import enrich_leads_with_owner_info
            all_leads = enrich_leads_with_owner_info(all_leads, max_lookups=50)
            print(f"[run] Owner info enrichment complete")
        except Exception as e:
            print(f"[run] Property lookup failed (non-fatal): {e}")
    else:
        print("[run] Skipping PA lookups (too many leads for this run)")

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
    # 6. Insert to Supabase
    # -------------------------------------------------------------------
    banner("Step 6: Upsert to Supabase")
    try:
        from db.insert import upsert_leads
        result = upsert_leads(unique_leads, supabase=supabase)
        print(f"[run] DB upsert result: {result}")
    except Exception as e:
        print(f"[run] DB upsert failed: {e}")
        return 1

    # -------------------------------------------------------------------
    # 7. Claude enrichment (score + outreach messages)
    # -------------------------------------------------------------------
    banner("Step 7: Claude Enrichment")
    try:
        from enrichment.enrich import run_enrichment
        enrich_result = run_enrichment(
            batch_size=int(os.environ.get("ENRICH_BATCH_SIZE", "10")),
            supabase=supabase,
        )
        print(f"[run] Enrichment result: {enrich_result}")
    except Exception as e:
        print(f"[run] Claude enrichment failed (non-fatal): {e}")

    elapsed = time.time() - start
    banner(f"Pipeline Complete in {elapsed:.1f}s")
    print(f"[run] Summary:")
    print(f"  Permit leads scraped:  {len(permit_leads)}")
    print(f"  Storm leads scraped:   {len(storm_leads)}")
    print(f"  Unique new leads:      {len(unique_leads)}")

    return 0


if __name__ == "__main__":
    sys.exit(run())
