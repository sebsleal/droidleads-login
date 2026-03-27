"""
Batch enrichment runner.

Fetches unenriched leads from Supabase, applies algorithmic scoring and
TEMPLATE: outreach placeholders, then updates the database.

Claude Code automation (enrich_leads.py) is responsible for replacing the
TEMPLATE: placeholders with real personalised messages — no API key needed
on the server side.
"""

import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

from enrichment.outreach_prompt import _fallback_template, needs_outreach_enrichment
from enrichment.score_prompt import _algorithmic_score

load_dotenv()

BATCH_SIZE = 10


def get_supabase() -> Client:
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running enrichment"
        )
    return create_client(
        supabase_url,
        service_role_key,
    )


def fetch_unenriched_leads(
    supabase: Client,
    batch_size: int = BATCH_SIZE,
) -> list[dict[str, Any]]:
    """
    Fetch leads that still need placeholder or personalised outreach.
    Criteria: outreach_message is blank or still starts with TEMPLATE:.
    """
    try:
        response = (
            supabase.table("leads")
            .select("*")
            .order("created_at", desc=False)
            .limit(max(batch_size * 5, batch_size))
            .execute()
        )
        rows = response.data or []
        pending = [
            row
            for row in rows
            if needs_outreach_enrichment(row.get("outreach_message"))
        ]
        return pending[:batch_size]
    except Exception as e:
        print(f"[enrich] Could not fetch unenriched leads: {e}")
        return []


def update_lead(
    supabase: Client,
    lead_id: str,
    score: int,
    outreach_message: str,
    score_reasoning: str = "",
) -> bool:
    """
    Update a lead's score, outreach_message (TEMPLATE: placeholder), and
    enriched_at timestamp in Supabase.
    """
    try:
        supabase.table("leads").update(
            {
                "score": score,
                "outreach_message": outreach_message,
                "score_reasoning": score_reasoning,
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", lead_id).execute()
        return True
    except Exception as e:
        print(f"[enrich] Failed to update lead {lead_id}: {e}")
        return False


def run_enrichment(
    batch_size: int = BATCH_SIZE,
    supabase: Client | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Main enrichment runner.

    Applies algorithmic scoring and TEMPLATE: outreach placeholders to
    unenriched leads in Supabase. Claude Code automation (enrich_leads.py)
    later replaces the TEMPLATE: strings with personalised messages.

    Args:
        batch_size: Number of leads to process per run.
        supabase:   Optional pre-built Supabase client.
        dry_run:    If True, computes enrichment but does not write to DB.

    Returns:
        Dict with 'processed', 'succeeded', 'failed' counts.
    """
    if supabase is None:
        supabase = get_supabase()

    leads = fetch_unenriched_leads(supabase, batch_size=batch_size)

    if not leads:
        print("[enrich] No unenriched leads found")
        return {"processed": 0, "succeeded": 0, "failed": 0}

    print(f"[enrich] Processing {len(leads)} leads (algorithmic scoring)...")

    processed = 0
    succeeded = 0
    failed = 0

    for lead in leads:
        lead_id = lead.get("id", "")
        address = lead.get("address", "Unknown")

        try:
            score = _algorithmic_score(lead)
            # TEMPLATE: prefix — Claude Code automation fills this in later
            outreach = _fallback_template(lead)

            processed += 1

            if dry_run:
                print(f"[enrich][dry-run] {address}: score={score}")
                print(f"  Message: {outreach[:100]}...")
                succeeded += 1
                continue

            ok = update_lead(
                supabase=supabase,
                lead_id=lead_id,
                score=score,
                outreach_message=outreach,
                score_reasoning="Algorithmic score — Claude Code will personalise outreach",
            )

            if ok:
                succeeded += 1
                print(f"[enrich] Scored lead {lead_id}: score={score}")
            else:
                failed += 1

        except Exception as e:
            print(f"[enrich] Error processing lead {lead_id} ({address}): {e}")
            failed += 1

    print(
        f"[enrich] Done — processed={processed}, succeeded={succeeded}, failed={failed}"
    )
    return {"processed": processed, "succeeded": succeeded, "failed": failed}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Score leads and write TEMPLATE: outreach placeholders"
    )
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    results = run_enrichment(batch_size=args.batch_size, dry_run=args.dry_run)
    print(results)
