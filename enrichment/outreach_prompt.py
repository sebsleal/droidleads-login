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

import os
from typing import Any

DEFAULT_OUTREACH_PHONE = "(800) 555-0100"
TEMPLATE_PREFIX = "TEMPLATE:"

# Words that indicate a corporate entity or placeholder — not a real last name
_CORP_SUFFIXES = {"llc", "inc", "corp", "ltd", "lp", "pa", "na", "co", "pllc"}
_NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
_SKIP_NAMES = {"reference only"}


def _normalize_name_token(value: str) -> str:
    return value.strip().lower().rstrip(".,")


def _format_salutation_value(value: str) -> str:
    value = value.strip().rstrip(".,")
    if not value:
        return "Property Owner"
    if value.isupper() or value.islower():
        return value.title()
    return value


def _salutation_name(owner_name: str | None) -> str:
    """Return an appropriate name to use in a salutation.

    - Returns 'Property Owner' for blanks, corporate entities, or placeholder names.
    - Handles property-record names in "LAST, FIRST" format.
    - Strips common personal suffixes like Jr./Sr./III.
    - Preserves existing last-name behavior for normal personal names.
    """
    if not owner_name:
        return "Property Owner"

    name = owner_name.strip()
    if not name or name.lower() in _SKIP_NAMES:
        return "Property Owner"

    normalized_parts = [_normalize_name_token(part) for part in name.replace(",", " ").split()]
    if not normalized_parts:
        return "Property Owner"
    if any(part in _CORP_SUFFIXES for part in normalized_parts):
        return "Property Owner"

    if "," in name:
        last_name_parts = [part for part in name.split(",", 1)[0].split() if part]
        while last_name_parts and _normalize_name_token(last_name_parts[-1]) in _NAME_SUFFIXES:
            last_name_parts.pop()
        return _format_salutation_value(" ".join(last_name_parts))

    parts = [part for part in name.split() if part]
    while parts and _normalize_name_token(parts[-1]) in _NAME_SUFFIXES:
        parts.pop()
    if not parts:
        return "Property Owner"
    return _format_salutation_value(parts[-1])


def is_template_message(message: str | None) -> bool:
    return (message or "").strip().startswith(TEMPLATE_PREFIX)


def needs_outreach_enrichment(message: str | None) -> bool:
    return not (message or "").strip() or is_template_message(message)


def _outreach_phone() -> str:
    return os.environ.get("OUTREACH_PHONE", DEFAULT_OUTREACH_PHONE)


def build_outreach_prompt(lead: dict[str, Any]) -> str:
    """
    Build a rich outreach prompt string for a lead.

    Used by Claude Code automation (enrich_leads.py) to give Claude
    full context when writing a personalised outreach message.

    Includes available enrichment signals:
    - FEMA declaration number (when lead has fema_declaration_number)
    - Permit status (Owner-Builder, Stalled, No Contractor)
    - Underpayment flag context (when underpaid_flag is True)
    - Insurance company and insurer risk (when insurance_company is present)
    """
    storm_line = (
        f"Related storm: {lead['storm_event']}" if lead.get("storm_event") else ""
    )

    last_name = _salutation_name(lead.get("owner_name"))
    outreach_phone = _outreach_phone()

    # Build enrichment signal lines
    extra_signals: list[str] = []

    fema_number = lead.get("fema_declaration_number")
    if fema_number:
        extra_signals.append(f"FEMA declaration: {fema_number}")

    permit_status = lead.get("permit_status")
    if permit_status:
        extra_signals.append(f"Permit status: {permit_status}")

    if lead.get("underpaid_flag"):
        extra_signals.append(
            "Underpayment flag: this property may have been underpaid on a prior claim"
        )

    insurance_company = lead.get("insurance_company")
    if insurance_company:
        insurer_risk = lead.get("insurer_risk")
        if insurer_risk:
            extra_signals.append(
                f"Insurance company: {insurance_company} (insurer risk: {insurer_risk})"
            )
        else:
            extra_signals.append(f"Insurance company: {insurance_company}")

    signals_block = "\n".join(extra_signals)

    # Build rules for enrichment signals
    extra_rules: list[str] = []
    if fema_number:
        extra_rules.append(
            f"- Reference the FEMA disaster declaration ({fema_number}) to add urgency"
        )
    if permit_status:
        extra_rules.append(
            f"- Note the permit status ({permit_status}) as a relevant context for their claim"
        )
    if lead.get("underpaid_flag"):
        extra_rules.append(
            "- Mention that the property may have been underpaid on a prior claim and we can help recover the difference"
        )
    if insurance_company:
        extra_rules.append(
            f"- Reference their insurer ({insurance_company}) by name to show you've done your research"
        )

    rules_block = "\n".join(extra_rules)

    return f"""You are a professional public adjuster outreach specialist for Claim Remedy Adjusters in Miami, FL.

Write a warm, professional 3-4 sentence outreach message to a property owner about their insurance claim.

Property: {lead.get("address", "")}, {lead.get("city", "Miami")}, FL {lead.get("zip", "")}
Owner last name: {last_name}
Damage type: {lead.get("damage_type", "Unknown")}
Permit filed: {lead.get("permit_type", "")} on {lead.get("permit_date", "")}
{storm_line}
{signals_block}

Rules:
- Address them by last name (e.g. "Dear Mr./Ms. {last_name},")
- Mention the specific damage type and the address
- Explain that Claim Remedy Adjusters can help maximize their insurance settlement
- Keep it warm and helpful, not salesy
- End with a clear call to action (call or text us at {outreach_phone})
- Do NOT use generic filler phrases like "I hope this message finds you well"
- Do NOT include a subject line or signature
{rules_block}

Output ONLY the message text, nothing else."""


def validate_outreach_message(message: str | None, lead: dict[str, Any]) -> bool:
    """
    Validate an outreach message for quality.

    Checks:
    1. Minimum length of 100 characters.
    2. Property address from the lead is present in the message.
    3. No placeholder tokens (TEMPLATE: prefix).

    Returns True if the message passes all checks, False otherwise.
    """
    if not message:
        return False

    msg = message.strip()

    # Check 1: minimum length
    if len(msg) < 100:
        return False

    # Check 2: no placeholder tokens
    if msg.upper().startswith(TEMPLATE_PREFIX.upper()):
        return False

    # Check 3: property address present
    address = lead.get("address", "")
    if address and address.lower() not in msg.lower():
        return False

    return True


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
    outreach_phone = _outreach_phone()

    storm_line = f" related to {storm}" if storm else ""

    body = (
        f"Dear {last_name}, our records indicate your property at {address} may have "
        f"sustained {damage.lower()} damage{storm_line}. "
        f"As a licensed Florida public adjuster, Claim Remedy Adjusters specializes in "
        f"maximizing insurance settlements at no upfront cost to you. "
        f"We'd love to schedule a free property inspection to ensure you receive every "
        f"dollar you deserve. Please call or text us at {outreach_phone}."
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
