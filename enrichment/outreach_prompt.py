"""
Claude outreach message generator for leads.

Writes personalised 3-4 sentence outreach messages for public adjuster
prospecting. One message per lead.
"""

import anthropic
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def build_outreach_prompt(lead: dict[str, Any]) -> str:
    storm_line = (
        f"Related storm: {lead['storm_event']}"
        if lead.get("storm_event")
        else ""
    )

    return f"""You are a professional public adjuster outreach specialist for Claim Remedy Adjusters in Miami, FL.

Write a warm, professional 3-4 sentence outreach message to a property owner about their insurance claim.

Property: {lead.get("address", "")}, {lead.get("city", "Miami")}, FL {lead.get("zip", "")}
Owner last name: {lead.get("owner_name", "Property Owner")}
Damage type: {lead.get("damage_type", "Unknown")}
Permit filed: {lead.get("permit_type", "")} on {lead.get("permit_date", "")}
{storm_line}

Rules:
- Address them by last name (e.g. "Dear Mr./Ms. [Last Name],")
- Mention the specific damage type and the address
- Explain that Claim Remedy Adjusters can help maximize their insurance settlement
- Keep it warm and helpful, not salesy
- End with a clear call to action (call or text us)
- Do NOT use generic filler phrases like "I hope this message finds you well"
- Do NOT include a subject line or signature

Output ONLY the message text, nothing else."""


def generate_outreach_message(
    lead: dict[str, Any],
    client: anthropic.Anthropic | None = None,
) -> str:
    """
    Generate a personalised outreach message for a single lead using Claude.

    Args:
        lead: Lead dict with owner_name, address, damage_type, etc.
        client: Optional pre-built Anthropic client.

    Returns:
        The outreach message string. Falls back to a template if Claude fails.
    """
    if client is None:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    prompt = build_outreach_prompt(lead)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=350,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip() if message.content else ""
        if text:
            return text
    except Exception as e:
        print(f"[outreach] Claude call failed for {lead.get('address')}: {e}")

    return _fallback_template(lead)


def _fallback_template(lead: dict[str, Any]) -> str:
    """Simple template fallback when Claude is unavailable."""
    last_name = (lead.get("owner_name") or "Property Owner").split()[-1]
    address = lead.get("address", "your property")
    damage = lead.get("damage_type", "storm")
    storm = lead.get("storm_event", "")

    storm_line = f" related to {storm}" if storm else ""

    return (
        f"Dear {last_name}, our records indicate your property at {address} may have "
        f"sustained {damage.lower()} damage{storm_line}. "
        f"As a licensed Florida public adjuster, Claim Remedy Adjusters specializes in "
        f"maximizing insurance settlements at no upfront cost to you. "
        f"We'd love to schedule a free property inspection to ensure you receive every "
        f"dollar you deserve. Please call or text us at (800) 555-0100."
    )


def generate_outreach_batch(
    leads: list[dict[str, Any]],
    client: anthropic.Anthropic | None = None,
) -> list[dict[str, Any]]:
    """
    Generate outreach messages for a list of leads.
    Only processes leads whose outreach_message is empty or starts with 'TEMPLATE:'.

    Args:
        leads: List of lead dicts.
        client: Optional Anthropic client.

    Returns:
        List of lead dicts with outreach_message populated.
    """
    if client is None:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    results: list[dict[str, Any]] = []
    generated = 0

    for lead in leads:
        existing = lead.get("outreach_message") or ""
        needs_message = not existing or existing.startswith("TEMPLATE:")

        if needs_message:
            msg = generate_outreach_message(lead, client)
            results.append({**lead, "outreach_message": msg})
            generated += 1
        else:
            results.append(lead)

    print(f"[outreach] Generated {generated} outreach messages")
    return results


if __name__ == "__main__":
    test_lead = {
        "owner_name": "Mendoza",
        "address": "1427 SW 8th St",
        "city": "Miami",
        "zip": "33135",
        "damage_type": "Hurricane/Wind",
        "permit_type": "Roof Replacement",
        "permit_date": "2026-03-10",
        "storm_event": "Hurricane Helene (Sept 2025)",
    }

    msg = generate_outreach_message(test_lead)
    print(msg)
