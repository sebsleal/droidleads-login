"""
Claude scoring prompt for leads.

Returns a 0-100 integer score representing the lead's quality,
urgency, and likelihood of converting to a public adjuster engagement.
"""

import anthropic
import json
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def build_score_prompt(lead: dict[str, Any]) -> str:
    return f"""You are a lead scoring expert for Claim Remedy Adjusters, a licensed Florida public adjuster firm in Miami.

Score the following insurance claim lead from 0 to 100 based on its quality, urgency, and conversion likelihood.

Lead details:
- Owner: {lead.get("owner_name", "Unknown")}
- Property: {lead.get("address", "Unknown")}, {lead.get("city", "Miami")}, FL {lead.get("zip", "")}
- Damage type: {lead.get("damage_type", "Unknown")}
- Permit type: {lead.get("permit_type", "Unknown")}
- Permit date: {lead.get("permit_date", "Unknown")}
- Storm event: {lead.get("storm_event") or "None recorded"}
- Has contact info: {"Yes" if lead.get("contact_email") or lead.get("contact_phone") else "No"}
- Source: {lead.get("source", "Unknown")}

Scoring criteria:
- Recency: Permits filed within 30 days are most valuable (+20); 31-60 days (+10)
- Damage type: Hurricane/Wind or Flood indicates highest claim potential (+25); Roof or Fire (+20); Structural (+20)
- Permit scope: Full roof replacement or structural permits suggest larger claims (+15)
- Contact availability: Having email or phone enables direct outreach (+15)
- Storm linkage: A named storm event confirms insurance eligibility (+10)
- Base score: 30

Additional qualitative factors to consider:
- High-value zip codes (Coral Gables, Coconut Grove, Brickell) increase score
- Commercial properties may have business interruption coverage (increase)
- Very old damage (>90 days) may be past claim filing deadlines (decrease)
- Vague permit descriptions suggest less actionable claims (decrease)

Respond with ONLY a JSON object in this exact format:
{{"score": <integer 0-100>, "reasoning": "<one sentence explanation>"}}"""


def score_lead(lead: dict[str, Any], client: anthropic.Anthropic | None = None) -> dict[str, Any]:
    """
    Score a single lead using Claude.

    Args:
        lead: Lead dict with damage_type, permit_type, permit_date, etc.
        client: Optional pre-built Anthropic client.

    Returns:
        Dict with 'score' (int) and 'reasoning' (str) keys.
        Falls back to algorithmic score if Claude call fails.
    """
    if client is None:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    prompt = build_score_prompt(lead)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )

        text = message.content[0].text.strip() if message.content else ""

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        result = json.loads(text)
        score = max(0, min(100, int(result.get("score", 30))))
        reasoning = str(result.get("reasoning", ""))
        return {"score": score, "reasoning": reasoning}

    except Exception as e:
        print(f"[score] Claude scoring failed for {lead.get('address')}: {e}")
        # Algorithmic fallback
        return {"score": _algorithmic_score(lead), "reasoning": "Algorithmic fallback"}


def _algorithmic_score(lead: dict[str, Any]) -> int:
    """Simple rule-based fallback scorer."""
    from datetime import date

    score = 30

    # Recency
    try:
        permit_date = date.fromisoformat(str(lead.get("permit_date", "")))
        days_ago = (date.today() - permit_date).days
        if days_ago <= 30:
            score += 20
        elif days_ago <= 60:
            score += 10
    except ValueError:
        pass

    # Damage type
    damage = lead.get("damage_type", "")
    if damage in ("Hurricane/Wind", "Flood"):
        score += 25
    elif damage in ("Roof", "Fire", "Structural"):
        score += 20

    # Permit scope
    permit_type = (lead.get("permit_type") or "").lower()
    if any(kw in permit_type for kw in ["replacement", "structural", "foundation", "load-bearing", "full roof"]):
        score += 15

    # Contact
    if lead.get("contact_email") or lead.get("contact_phone"):
        score += 15

    # Storm linkage
    if lead.get("storm_event"):
        score += 10

    return min(score, 100)


def score_leads_batch(
    leads: list[dict[str, Any]],
    use_claude: bool = True,
    client: anthropic.Anthropic | None = None,
) -> list[dict[str, Any]]:
    """
    Score a list of leads, either using Claude or the algorithmic fallback.

    Args:
        leads: List of lead dicts.
        use_claude: If True, uses Claude API for scoring. Otherwise, algorithmic only.
        client: Optional Anthropic client.

    Returns:
        List of lead dicts with 'score' field updated.
    """
    if use_claude and client is None:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    results: list[dict[str, Any]] = []
    for lead in leads:
        if use_claude:
            scored = score_lead(lead, client)
        else:
            scored = {"score": _algorithmic_score(lead), "reasoning": "Algorithmic"}

        results.append({**lead, "score": scored["score"], "score_reasoning": scored["reasoning"]})

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
        "contact_email": "c.mendoza@gmail.com",
        "source": "permit",
    }

    result = score_lead(test_lead)
    print(result)
