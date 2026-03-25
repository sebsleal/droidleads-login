"""
Lead scoring for Claim Remedy Adjusters.

Provides:
  - build_score_prompt()     — rich prompt string for Claude Code automation
  - _algorithmic_score()     — fast rule-based scorer used by the pipeline
  - score_leads_batch()      — batch wrapper around _algorithmic_score

Scoring is done algorithmically by the Railway scraper pipeline.
The prompt text in build_score_prompt() is surfaced to Claude Code
automation (enrich_leads.py) so the IDE can reason about each lead
and produce a nuanced 0-100 score + outreach message — no API key needed.
"""

from typing import Any


def build_score_prompt(lead: dict[str, Any]) -> str:
    """
    Build a rich scoring prompt string for a lead.

    This is used by Claude Code automation (enrich_leads.py) to give
    Claude full context when scoring each lead and writing outreach.
    """
    # Build optional enrichment context lines
    extras = []
    if lead.get("assessed_value") or lead.get("assessedValue"):
        val = lead.get("assessed_value") or lead.get("assessedValue")
        extras.append(f"- Assessed property value: ${val:,}")
    if lead.get("homestead") is not None:
        extras.append(f"- Homestead (owner-occupied): {'Yes' if lead.get('homestead') else 'No'}")
    if lead.get("absenteeOwner") is not None or lead.get("absentee_owner") is not None:
        is_absentee = lead.get("absenteeOwner") or lead.get("absentee_owner")
        extras.append(f"- Absentee owner (out-of-state): {'Yes' if is_absentee else 'No'}")
    if lead.get("roofAge") or lead.get("roof_age"):
        age = lead.get("roofAge") or lead.get("roof_age")
        extras.append(f"- Estimated roof age: {age} years")
    if lead.get("priorPermitCount") or lead.get("prior_permit_count"):
        count = lead.get("priorPermitCount") or lead.get("prior_permit_count")
        extras.append(f"- Prior permits at this address: {count}")
    if lead.get("permitStatus") or lead.get("permit_status"):
        status = lead.get("permitStatus") or lead.get("permit_status")
        extras.append(f"- Permit status: {status}")
    if lead.get("permitValue") or lead.get("permit_value"):
        val = lead.get("permitValue") or lead.get("permit_value")
        extras.append(f"- Permit estimated value: ${val:,}")
    if lead.get("underpaidFlag") or lead.get("underpaid_flag"):
        extras.append("- Underpaid flag: Permit value significantly below ZIP median (possible underpayment)")
    if lead.get("contractorName") or lead.get("contractor_name"):
        name = lead.get("contractorName") or lead.get("contractor_name")
        extras.append(f"- Contractor: {name}")

    enrichment_section = "\n".join(extras) if extras else "- No additional enrichment data available"

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

Enrichment data:
{enrichment_section}

Scoring criteria:
- Recency: Permits filed within 30 days are most valuable (+20); 31-60 days (+10)
- Damage type: Hurricane/Wind or Flood indicates highest claim potential (+25); Roof or Fire (+20); Structural (+20)
- Permit scope: Full roof replacement or structural permits suggest larger claims (+15)
- Contact availability: Having email or phone enables direct outreach (+15)
- Storm linkage: A named storm event confirms insurance eligibility (+10)
- Owner-occupied (homestead): More likely to engage directly (+10)
- Absentee owner: May have unresolved claim, needs professional help (+10)
- Aging roof (>15 years): Higher replacement cost, stronger claim (+10)
- Repeat damage (prior permits): Established damage history, strong claim (+15)
- Permit status Owner-Builder/No Contractor: Owner handling claim alone — ideal target (+20)
- Stalled permit (no inspection >60 days): Owner may be stuck — intervention opportunity (+15)
- Underpayment flag: Permit value below median — likely underpaid by insurer (+15)
- Base score: 30

Additional qualitative factors:
- High-value ZIP codes (Coral Gables 33134, Coconut Grove 33133, Brickell 33131, Key Biscayne 33149, Pinecrest 33156) → increase score
- High assessed value (>$500K) → increase score
- Commercial properties may have business interruption coverage → increase
- Very old damage (>90 days) may be past claim filing deadlines → decrease
- Vague permit descriptions suggest less actionable claims → decrease

Respond with ONLY a JSON object in this exact format:
{{"score": <integer 0-100>, "reasoning": "<one sentence explanation>"}}"""


def _algorithmic_score(lead: dict[str, Any]) -> int:
    """
    Rule-based lead scorer used by the Railway scraper pipeline.

    Mirrors the scoring criteria in build_score_prompt() so that leads
    arrive in Supabase with a sensible pre-score before Claude Code
    automation reviews and refines them.
    """
    from datetime import date

    score = 30  # base

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
    damage = lead.get("damage_type", "") or lead.get("damageType", "")
    if damage in ("Hurricane/Wind", "Flood"):
        score += 25
    elif damage in ("Roof", "Fire", "Structural"):
        score += 20

    # Permit scope
    permit_type = (lead.get("permit_type") or lead.get("permitType") or "").lower()
    if any(kw in permit_type for kw in ["replacement", "structural", "foundation", "load-bearing", "full roof"]):
        score += 15

    # Contact info
    if lead.get("contact_email") or lead.get("contact_phone"):
        score += 15
    elif (lead.get("contact") or {}).get("phone") or (lead.get("contact") or {}).get("email"):
        score += 15

    # Storm linkage
    if lead.get("storm_event") or lead.get("stormEvent"):
        score += 10

    # Permit status bonuses
    permit_status = lead.get("permit_status") or lead.get("permitStatus") or "Active"
    if permit_status in ("Owner-Builder", "No Contractor"):
        score += 20
    elif permit_status == "Stalled":
        score += 15

    # Underpayment flag
    if lead.get("underpaid_flag") or lead.get("underpaidFlag"):
        score += 15

    # Repeat damage
    prior = lead.get("prior_permit_count") or lead.get("priorPermitCount") or 0
    if prior >= 1:
        score += 15

    # Homestead (owner-occupied)
    if lead.get("homestead"):
        score += 10

    # Absentee owner
    if lead.get("absentee_owner") or lead.get("absenteeOwner"):
        score += 10

    # Aging roof
    roof_age = lead.get("roof_age") or lead.get("roofAge") or 0
    if roof_age > 15:
        score += 10

    return min(score, 100)


def score_leads_batch(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Algorithmically score a list of leads.

    Returns list of lead dicts with 'score' and 'score_reasoning' fields set.
    """
    results = []
    for lead in leads:
        score = _algorithmic_score(lead)
        results.append({
            **lead,
            "score": score,
            "score_reasoning": "Algorithmic pre-score",
        })
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

    score = _algorithmic_score(test_lead)
    print(f"Score: {score}")
    print("\n--- Scoring prompt (used by Claude Code automation) ---")
    print(build_score_prompt(test_lead))
