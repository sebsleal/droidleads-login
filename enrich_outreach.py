"""
enrich_outreach.py — Claude API outreach enrichment

Reads public/leads.json, finds leads that still have a TEMPLATE: placeholder
outreach message, and calls the Claude API to write a warm, personalized
3-4 sentence message for each one.

Prioritizes by score (highest first) so the best leads always get done first.
Processes up to MAX_PER_RUN leads per execution to keep API cost predictable.

Designed to run as a GitHub Action after the scraper finishes.
Requires: ANTHROPIC_API_KEY environment variable.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import anthropic

from enrichment.outreach_prompt import build_outreach_prompt, needs_outreach_enrichment

LEADS_PATH = Path(__file__).resolve().parent / "public" / "leads.json"

# How many leads to enrich per run. Keeps cost predictable.
# At ~700 tokens per lead with Haiku: 100 leads ≈ $0.05 per run.
MAX_PER_RUN = 100

# Claude model to use for outreach generation.
# Haiku is fast, cheap, and perfectly capable for message writing.
MODEL = "claude-haiku-4-5-20251001"

# Delay between API calls to stay well within rate limits.
DELAY_BETWEEN_CALLS = 0.3  # seconds


def load_leads() -> dict:
    if not LEADS_PATH.exists():
        print("[enrich] No leads.json found — run the scraper first.")
        sys.exit(1)
    return json.loads(LEADS_PATH.read_text(encoding="utf-8"))


def save_leads(data: dict) -> None:
    LEADS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def generate_message(client: anthropic.Anthropic, lead: dict) -> str | None:
    """Call Claude API and return the personalized outreach message."""
    prompt = build_outreach_prompt(lead)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except anthropic.APIError as e:
        print(f"[enrich] API error for lead {lead.get('id', '?')}: {e}")
        return None


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[enrich] ANTHROPIC_API_KEY not set — skipping enrichment.")
        sys.exit(0)

    data = load_leads()
    leads: list[dict] = data.get("leads", [])

    # Find leads that still need a real message
    needs_work = [
        lead for lead in leads
        if needs_outreach_enrichment(lead.get("outreachMessage"))
    ]

    if not needs_work:
        print(f"[enrich] All {len(leads)} leads already have outreach messages. Nothing to do.")
        return

    # Prioritize by score — best leads first
    needs_work.sort(key=lambda l: l.get("score", 0), reverse=True)
    batch = needs_work[:MAX_PER_RUN]

    print(f"[enrich] {len(leads)} total leads | {len(needs_work)} need enrichment | processing top {len(batch)}")

    client = anthropic.Anthropic(api_key=api_key)

    # Build a lookup for fast updates
    lead_index = {lead["id"]: lead for lead in leads}

    succeeded = 0
    failed = 0

    for i, lead in enumerate(batch, 1):
        lead_id = lead.get("id", "")
        address = lead.get("propertyAddress") or lead.get("address", "Unknown")
        score = lead.get("score", 0)

        print(f"[enrich] ({i}/{len(batch)}) score={score} — {address}")

        message = generate_message(client, lead)

        if message:
            lead_index[lead_id]["outreachMessage"] = message
            succeeded += 1
            print(f"           ✓ {message[:80]}...")
        else:
            failed += 1
            print(f"           ✗ Failed — keeping TEMPLATE placeholder")

        if i < len(batch):
            time.sleep(DELAY_BETWEEN_CALLS)

    # Write back
    data["leads"] = list(lead_index.values())
    save_leads(data)

    remaining = len(needs_work) - succeeded
    print(
        f"\n[enrich] Done — enriched={succeeded} | failed={failed} | "
        f"still pending={max(0, remaining)}"
    )
    if remaining > MAX_PER_RUN:
        print(f"[enrich] {remaining - MAX_PER_RUN} leads remain — will process on next run.")


if __name__ == "__main__":
    main()
