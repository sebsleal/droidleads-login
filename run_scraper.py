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

from pipeline.leads import build_canonical_lead_dataset, write_leads_json

load_dotenv()


def banner(step: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n{'=' * 60}")
    print(f"  {step}")
    print(f"  {ts}")
    print(f"{'=' * 60}")


def run() -> int:
    start = time.time()
    banner("Claim Remedy Adjusters — Scraper Pipeline Starting")
    supabase = None
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        try:
            from db.insert import get_client

            supabase = get_client()
        except Exception as e:
            print(f"[run] Could not initialise Supabase client: {e}")

    banner("Step 1-6: Canonical Lead Pipeline")
    result = build_canonical_lead_dataset(supabase=supabase)
    if not result.leads:
        print("[run] No leads scraped — exiting early")
        return 1

    banner("Step 7: Upsert to Supabase")
    if not supabase:
        print(
            "[run] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — skipping DB upsert"
        )
    else:
        try:
            from db.insert import upsert_leads

            upsert_result = upsert_leads(result.leads, supabase=supabase)
            print(f"[run] DB upsert result: {upsert_result}")
        except Exception as e:
            print(f"[run] DB upsert failed (non-fatal): {e}")

    banner("Step 8: Refresh dashboard datasets")
    try:
        write_leads_json(result.leads)
        print("[run] Canonical public/leads.json refreshed")
    except Exception as e:
        print(f"[run] Could not write public/leads.json: {e}")

    try:
        import subprocess

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
        print(f"[run] Storm candidate regeneration failed (non-fatal): {e}")

    elapsed = time.time() - start

    banner(f"Pipeline Complete in {elapsed:.1f}s")
    print(f"[run] Summary:")
    print(f"  Permit leads scraped:  {result.permit_count}")
    print(f"  Storm leads scraped:   {result.storm_count}")
    print(f"  Pre-permit leads:      {result.pre_permit_count}")
    print(f"  Canonical leads:       {len(result.leads)}")
    print(f"  FEMA-tagged leads:     {result.fema_tagged_count}")
    for county, count in result.county_counts.items():
        print(f"  {county}: {count} leads")

    return 0


if __name__ == "__main__":
    sys.exit(run())
