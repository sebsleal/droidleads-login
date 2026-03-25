"""
Batch enrichment runner.

Fetches unenriched leads from Supabase, runs Claude scoring and outreach
message generation in batches of 10, then updates the database.
"""

import os
import time
from typing import Any

import anthropic
from dotenv import load_dotenv
from supabase import create_client, Client

from enrichment.score_prompt import score_lead
from enrichment.outreach_prompt import generate_outreach_message

load_dotenv()

BATCH_SIZE = 10
RATE_LIMIT_DELAY = 1.0  # seconds between Claude API calls (conservative)


def get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"],
    )


def fetch_unenriched_leads(
    supabase: Client,
    batch_size: int = BATCH_SIZE,
) -> list[dict[str, Any]]:
    """
    Fetch leads that have not yet been enriched by Claude.
    Criteria: outreach_message is empty, starts with 'TEMPLATE:', or enriched_at is null.

    Args:
        supabase: Supabase client.
        batch_size: Maximum number of leads to fetch.

    Returns:
        List of lead dicts.
    """
    try:
        response = (
            supabase.table("leads")
            .select("*")
            .is_("enriched_at", "null")
            .order("created_at", desc=False)
            .limit(batch_size)
            .execute()
        )
        return response.data or []
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
    Update a lead's score, outreach_message, and enriched_at timestamp.

    Args:
        supabase: Supabase client.
        lead_id: The lead's primary key.
        score: Integer score 0-100.
        outreach_message: Claude-generated message.
        score_reasoning: Optional one-sentence reasoning from the scorer.

    Returns:
        True if update succeeded, False otherwise.
    """
    from datetime import datetime, timezone

    try:
        supabase.table("leads").update({
            "score": score,
            "outreach_message": outreach_message,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", lead_id).execute()
        return True
    except Exception as e:
        print(f"[enrich] Failed to update lead {lead_id}: {e}")
        return False


def run_enrichment(
    batch_size: int = BATCH_SIZE,
    supabase: Client | None = None,
    anthropic_client: anthropic.Anthropic | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Main enrichment runner. Fetches unenriched leads and processes them.

    Args:
        batch_size: Number of leads to process per run.
        supabase: Optional pre-built Supabase client.
        anthropic_client: Optional pre-built Anthropic client.
        dry_run: If True, generates enrichment but does not write to DB.

    Returns:
        Dict with 'processed', 'succeeded', 'failed' counts.
    """
    if supabase is None:
        supabase = get_supabase()

    if anthropic_client is None:
        anthropic_client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )

    leads = fetch_unenriched_leads(supabase, batch_size=batch_size)

    if not leads:
        print("[enrich] No unenriched leads found")
        return {"processed": 0, "succeeded": 0, "failed": 0}

    print(f"[enrich] Processing {len(leads)} leads...")

    processed = 0
    succeeded = 0
    failed = 0

    for lead in leads:
        lead_id = lead.get("id", "")
        address = lead.get("address", "Unknown")

        try:
            # Score
            score_result = score_lead(lead, client=anthropic_client)
            time.sleep(RATE_LIMIT_DELAY)

            # Outreach message
            outreach = generate_outreach_message(lead, client=anthropic_client)
            time.sleep(RATE_LIMIT_DELAY)

            processed += 1

            if dry_run:
                print(f"[enrich][dry-run] {address}: score={score_result['score']}")
                print(f"  Message: {outreach[:100]}...")
                succeeded += 1
                continue

            ok = update_lead(
                supabase=supabase,
                lead_id=lead_id,
                score=score_result["score"],
                outreach_message=outreach,
                score_reasoning=score_result.get("reasoning", ""),
            )

            if ok:
                succeeded += 1
                print(f"[enrich] Enriched lead {lead_id}: score={score_result['score']}")
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

    parser = argparse.ArgumentParser(description="Enrich leads with Claude scoring and outreach")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    results = run_enrichment(batch_size=args.batch_size, dry_run=args.dry_run)
    print(results)
