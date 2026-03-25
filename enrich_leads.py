"""
enrich_leads.py — Claude Code enrichment runner

This script is called by the Claude Code scheduled task.
It reads public/leads.json, finds leads with TEMPLATE: outreach messages,
and prints them to stdout so Claude can write real outreach messages.

Claude then writes the enriched file back via the scheduled task.

Usage (from Claude Code scheduled task):
    python enrich_leads.py

The scheduled task prompt instructs Claude to:
1. Run this script to see which leads need enrichment
2. Write personalized outreach messages for each
3. Update public/leads.json with the new messages
4. git add + commit + push so Vercel redeploys
"""

import json
import os
import sys

LEADS_PATH = os.path.join(os.path.dirname(__file__), "public", "leads.json")


def load_leads() -> dict:
    if not os.path.exists(LEADS_PATH):
        print("No leads.json found. Run generate_leads.py first.")
        sys.exit(1)
    with open(LEADS_PATH) as f:
        return json.load(f)


def save_leads(data: dict):
    with open(LEADS_PATH, "w") as f:
        json.dump(data, f, indent=2)


def main():
    data = load_leads()
    leads = data.get("leads", [])

    needs_enrichment = [l for l in leads if l.get("outreachMessage", "").startswith("TEMPLATE:")]
    already_enriched = len(leads) - len(needs_enrichment)

    print(f"Total leads: {len(leads)}")
    print(f"Already enriched: {already_enriched}")
    print(f"Needs enrichment: {len(needs_enrichment)}")

    if not needs_enrichment:
        print("\nAll leads already have outreach messages. Nothing to do.")
        return

    print("\n--- LEADS TO ENRICH ---")
    for i, lead in enumerate(needs_enrichment, 1):
        print(f"\n[{i}] ID: {lead['id']}")
        print(f"    Owner: {lead['ownerName']}")
        print(f"    Address: {lead['propertyAddress']}, Miami FL {lead['zip']}")
        print(f"    Damage: {lead['damageType']} | Permit: {lead['permitType']}")
        print(f"    Storm: {lead.get('stormEvent') or 'N/A'}")
        print(f"    Score: {lead['score']}")
        contact = lead.get("contact") or {}
        print(f"    Contact: email={contact.get('email', 'none')} phone={contact.get('phone', 'none')}")
        print(f"    Current message: {lead['outreachMessage'][:80]}...")

    print("\n--- END OF LEADS ---")
    print("\nInstructions for Claude:")
    print("For each lead above, write a warm 3-4 sentence outreach message.")
    print("Call update_outreach(lead_id, message) for each one, then save.")


def update_outreach(lead_id: str, message: str):
    """Update a single lead's outreach message and save to file."""
    data = load_leads()
    leads = data.get("leads", [])
    for lead in leads:
        if lead["id"] == lead_id:
            lead["outreachMessage"] = message
            break
    save_leads(data)
    print(f"Updated lead {lead_id}")


if __name__ == "__main__":
    main()
