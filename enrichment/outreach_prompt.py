"""
Outreach message templates for Claim Remedy Adjusters.

Provides:
  - build_outreach_prompt()   — rich prompt string for Claude Code automation
  - _fallback_template()      — deterministic template used as placeholder
  - generate_outreach_batch() — batch wrapper that stamps TEMPLATE: placeholders

The Railway pipeline writes TEMPLATE: placeholders via _fallback_template().
Claude Code automation (enrich_leads.py) later reads these placeholders and
replaces them with personalised messages — no API key needed on the server.
"""

from typing import Any

TEMPLATE_PREFIX = "TEMPLATE:"

# Words that indicate a corporate entity or placeholder — not a real last name
_CORP_SUFFIXES = {"llc", "inc", "corp", "ltd", "lp", "pa", "na", "co", "pllc"}
_SKIP_NAMES = {"reference only"}


def _salutation_name(owner_name: str | None) -> str:
    """Return an appropriate name to use in a salutation.

    - Returns 'Property Owner' for blanks, corporate entities, or placeholder names.
    - Returns the last word for normal personal names.
    """
    if not owner_name:
        return "Property Owner"
    name = owner_name.strip()
    if name.lower() in _SKIP_NAMES:
        return "Property Owner"
    parts = name.split()
    if not parts:
        return "Property Owner"
    last = parts[-1].lower().rstrip(".,")
    if last in _CORP_SUFFIXES:
        return "Property Owner"
    return parts[-1]


def is_template_message(message: str | None) -> bool:
    return (message or "").strip().startswith(TEMPLATE_PREFIX)


def needs_outreach_enrichment(message: str | None) -> bool:
    return not (message or "").strip() or is_template_message(message)


def build_outreach_prompt(lead: dict[str, Any]) -> str:
    """
    Build a rich outreach prompt string for a lead.

    Used by Claude Code automation (enrich_leads.py) to give Claude
    full context when writing a personalised outreach message.
    """
    storm_line = (
        f"Related storm: {lead['storm_event']}" if lead.get("storm_event") else ""
    )

    last_name = _salutation_name(lead.get("owner_name"))

    return f"""You are a professional public adjuster outreach specialist for Claim Remedy Adjusters in Miami, FL.

Write a warm, professional 3-4 sentence outreach message to a property owner about their insurance claim.

Property: {lead.get("address", "")}, {lead.get("city", "Miami")}, FL {lead.get("zip", "")}
Owner last name: {last_name}
Damage type: {lead.get("damage_type", "Unknown")}
Permit filed: {lead.get("permit_type", "")} on {lead.get("permit_date", "")}
{storm_line}

Rules:
- Address them by last name (e.g. "Dear Mr./Ms. {last_name},")
- Mention the specific damage type and the address
- Explain that Claim Remedy Adjusters can help maximize their insurance settlement
- Keep it warm and helpful, not salesy
- End with a clear call to action (call or text us)
- Do NOT use generic filler phrases like "I hope this message finds you well"
- Do NOT include a subject line or signature

Output ONLY the message text, nothing else."""


def _fallback_template(lead: dict[str, Any]) -> str:
    """
    TEMPLATE: placeholder written by the Railway scraper pipeline.

    Claude Code automation detects the 'TEMPLATE:' prefix and replaces
    this with a personalised message during its enrichment pass.
    """
    last_name = _salutation_name(lead.get("owner_name"))
    address = lead.get("address", "your property")
    damage = lead.get("damage_type", "storm")
    storm = lead.get("storm_event", "")

    storm_line = f" related to {storm}" if storm else ""

    body = (
        f"Dear {last_name}, our records indicate your property at {address} may have "
        f"sustained {damage.lower()} damage{storm_line}. "
        f"As a licensed Florida public adjuster, Claim Remedy Adjusters specializes in "
        f"maximizing insurance settlements at no upfront cost to you. "
        f"We'd love to schedule a free property inspection to ensure you receive every "
        f"dollar you deserve. Please call or text us at (800) 555-0100."
    )
    return f"{TEMPLATE_PREFIX} {body}"


def generate_outreach_batch(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Stamp TEMPLATE: outreach placeholders onto leads that don't have a
    real message yet. The pipeline calls this before upserting to Supabase.

    Only touches leads whose outreach_message is empty or already a TEMPLATE:.
    Claude Code automation will replace these with personalised messages.
    """
    results = []
    stamped = 0

    for lead in leads:
        existing = lead.get("outreach_message") or ""
        needs_message = needs_outreach_enrichment(existing)

        if needs_message:
            results.append({**lead, "outreach_message": _fallback_template(lead)})
            stamped += 1
        else:
            results.append(lead)

    print(f"[outreach] Stamped {stamped} TEMPLATE: placeholders")
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

    print("--- TEMPLATE: placeholder ---")
    print(_fallback_template(test_lead))
    print("\n--- Outreach prompt (used by Claude Code automation) ---")
    print(build_outreach_prompt(test_lead))
