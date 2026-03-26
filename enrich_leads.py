"""
enrich_leads.py - Codex enrichment runner

This script is intended for a Codex / ChatGPT automation.
It reads public/leads.json, finds leads with TEMPLATE: outreach messages,
and prints rich context so Codex can write personalized outreach messages.

Codex then:
1. Writes a warm, personalized 3-4 sentence message for each lead
2. Calls update_outreach(lead_id, message) for each one
3. git add public/leads.json && git commit -m "chore: enrich outreach messages [skip ci]" && git push

Usage:
    python3 enrich_leads.py
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

    needs_enrichment = [
        l for l in leads
        if not l.get("outreachMessage") or l.get("outreachMessage", "").startswith("TEMPLATE:")
    ]
    already_enriched = len(leads) - len(needs_enrichment)

    print(f"Total leads: {len(leads)}")
    print(f"Already enriched: {already_enriched}")
    print(f"Needs enrichment: {len(needs_enrichment)}")

    if not needs_enrichment:
        print("\nAll leads already have outreach messages. Nothing to do.")
        return

    print("\n--- LEADS TO ENRICH ---")
    for i, lead in enumerate(needs_enrichment, 1):
        county = lead.get("county", "miami-dade")
        county_label = {
            "miami-dade":  "Miami-Dade County",
            "broward":     "Broward County",
            "palm-beach":  "Palm Beach County",
        }.get(county, county.title())

        contact = lead.get("contact") or {}
        fema_num  = lead.get("femaDeclarationNumber", "")
        fema_type = lead.get("femaIncidentType", "")
        fema_line = f" | FEMA {fema_num} ({fema_type})" if fema_num else ""

        city = lead.get("city") or "Miami"
        zip_code = lead.get("zip") or ""
        location = f"{lead.get('propertyAddress', '')}, {city}, FL {zip_code}".strip(", ")

        print(f"\n[{i}] ID: {lead['id']}")
        print(f"    Owner:    {lead['ownerName']}")
        print(f"    Address:  {location}")
        print(f"    County:   {county_label}{fema_line}")
        print(f"    Damage:   {lead['damageType']} | Permit: {lead['permitType']}")
        print(f"    Storm:    {lead.get('stormEvent') or 'N/A'}")
        print(f"    Score:    {lead['score']}")
        print(f"    Contact:  email={contact.get('email', 'none')} | phone={contact.get('phone', 'none')}")
        if lead.get("homestead") is True:
            print(f"    Homestead: Yes (owner-occupied)")
        if lead.get("absenteeOwner"):
            print(f"    Owner:    ABSENTEE (out of state)")
        if lead.get("permitStatus") in ("Owner-Builder", "No Contractor"):
            print(f"    Status:   {lead['permitStatus']} — handling claim alone")
        if lead.get("permitStatus") == "Stalled":
            print(f"    Status:   STALLED PERMIT — work may have stopped mid-repair")
        if lead.get("underpaidFlag"):
            print(f"    Flag:     LIKELY UNDERPAID — permit value below ZIP median")
        if lead.get("roofAge") and lead["roofAge"] > 15:
            print(f"    Roof Age: ~{lead['roofAge']} years (aging roof)")
        if lead.get("priorPermitCount") and lead["priorPermitCount"] >= 2:
            print(f"    History:  {lead['priorPermitCount']} prior permits at this address (repeat damage)")
        print(f"    Current:  {lead['outreachMessage'][:80]}...")

    print("\n--- END OF LEADS ---")
    print("""
Instructions for Codex:
For each lead above, write a warm, professional 3-4 sentence outreach message.

Rules:
- Address them by last name (e.g. "Dear Mr./Ms. Smith,")
- Mention the specific damage type and the exact address
- Reference the storm event or FEMA declaration if present
- Explain that Claim Remedy Adjusters can maximize their insurance settlement
- Keep tone warm and helpful — not salesy
- End with a clear call to action (call or text us)
- For Broward/Palm Beach leads, adjust city references accordingly (not "Miami")
- Do NOT include a subject line or signature
- Do NOT use generic phrases like "I hope this message finds you well"

For each lead, call: update_outreach("LEAD_ID", "your message here")
Then commit: git add public/leads.json && git commit -m "chore: enrich outreach messages [skip ci]" && git push
""")


def update_outreach(lead_id: str, message: str):
    """Update a single lead's outreach message and save to file."""
    data = load_leads()
    leads = data.get("leads", [])
    updated = False
    for lead in leads:
        if lead["id"] == lead_id:
            lead["outreachMessage"] = message
            updated = True
            break
    if updated:
        save_leads(data)
        print(f"✓ Updated lead {lead_id}")
    else:
        print(f"✗ Lead {lead_id} not found")


if __name__ == "__main__":
    main()
