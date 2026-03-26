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

Insurer risk and score weights are data-driven from 120+ real closed claims:
  - Bathroom/Accidental Discharge = 65.2% of settled claims (highest revenue)
  - Hurricane/Wind = 25.2% of settlements
  - Tower Hill / Progressive = strongest payers ($31K+ in fees each)
  - Integon National = near 100% litigation rate
  - Citizens (Wind/Rain) = high litigation risk
"""

from typing import Any


# ---------------------------------------------------------------------------
# Insurer risk table — derived from 120+ closed Claim Remedy cases
# ---------------------------------------------------------------------------

INSURER_RISK_TABLE: dict[str, dict] = {
    "integon national": {
        "risk": "high",
        "litigation_rate": 0.95,
        "label": "Near 100% Litigation",
        "score_modifier": -20,
    },
    "citizens": {
        "risk": "high",
        "litigation_rate": 0.50,
        "label": "High Litigation Risk",
        "score_modifier": -10,
    },
    "state farm": {
        "risk": "medium",
        "litigation_rate": 0.35,
        "label": "Mixed Outcomes",
        "score_modifier": 0,
    },
    "statefarm": {
        "risk": "medium",
        "litigation_rate": 0.35,
        "label": "Mixed Outcomes",
        "score_modifier": 0,
    },
    "tower hill": {
        "risk": "low",
        "litigation_rate": 0.10,
        "label": "Strong Payer",
        "score_modifier": +10,
    },
    "progressive": {
        "risk": "low",
        "litigation_rate": 0.12,
        "label": "Strong Payer",
        "score_modifier": +10,
    },
    "universal property": {
        "risk": "low",
        "litigation_rate": 0.20,
        "label": "Reliable Payer",
        "score_modifier": +5,
    },
    "universal north america": {
        "risk": "low",
        "litigation_rate": 0.18,
        "label": "Reliable Payer",
        "score_modifier": +5,
    },
    "homeowners choice": {
        "risk": "medium",
        "litigation_rate": 0.30,
        "label": "Moderate Risk",
        "score_modifier": +2,
    },
    "florida peninsula": {
        "risk": "low",
        "litigation_rate": 0.15,
        "label": "Reliable Payer",
        "score_modifier": +5,
    },
    "cypress": {
        "risk": "low",
        "litigation_rate": 0.15,
        "label": "Reliable Payer",
        "score_modifier": +5,
    },
    "slide": {
        "risk": "medium",
        "litigation_rate": 0.25,
        "label": "Moderate Risk",
        "score_modifier": +2,
    },
    "monarch national": {
        "risk": "low",
        "litigation_rate": 0.15,
        "label": "Reliable Payer",
        "score_modifier": +5,
    },
}


def get_insurer_risk(insurer_name: str) -> dict | None:
    """Look up insurer risk data by name (case-insensitive, partial match)."""
    if not insurer_name:
        return None
    key = insurer_name.lower().strip()
    for insurer_key, data in INSURER_RISK_TABLE.items():
        if insurer_key in key or key in insurer_key:
            return data
    return None


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

    # Insurer risk context
    insurer = lead.get("insurance_company") or lead.get("insuranceCompany") or ""
    risk_data = get_insurer_risk(insurer)
    if insurer:
        extras.append(f"- Insurance company: {insurer}")
    if risk_data:
        extras.append(f"- Insurer risk: {risk_data['label']} (litigation rate: {int(risk_data['litigation_rate']*100)}%)")

    enrichment_section = "\n".join(extras) if extras else "- No additional enrichment data available"

    return f"""You are a lead scoring expert for Claim Remedy Adjusters, a licensed Florida public adjuster firm in Miami.

Score the following insurance claim lead from 0 to 100 based on its quality, urgency, and conversion likelihood.

IMPORTANT CONTEXT FROM REAL CLOSED CLAIMS (120+ cases):
- Bathroom/Accidental Discharge = 65.2% of all settled claims — highest revenue damage type
- Hurricane/Wind = 25.2% of settlements
- Tower Hill and Progressive are strong payers; Citizens and Integon have high litigation rates
- Expected value = P(settled) × avg_settlement × fee_rate is the real driver of lead quality

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

Scoring criteria (data-driven from 120+ real cases):
- Recency: Permits filed within 30 days are most valuable (+20); 31-60 days (+10)
- Damage type: Accidental Discharge/Bathroom (+30) — highest real-world settlement rate; Hurricane/Wind (+20); Roof (+18); Fire (+15); Structural (+15); Flood (+12)
- Insurer: Strong payers (Tower Hill, Progressive, Universal) increase score (+5 to +10); High litigation risk (Citizens, Integon) decrease score (-10 to -20)
- Permit scope: Full roof replacement or structural permits suggest larger claims (+15)
- Contact availability: Having email or phone enables direct outreach (+12)
- Storm linkage: A named storm event confirms insurance eligibility (+10)
- Owner-occupied (homestead): More likely to engage directly (+10)
- Absentee owner: May have unresolved claim, needs professional help (+10)
- Aging roof (>15 years): Higher replacement cost, stronger claim (+10)
- Repeat damage (prior permits): Established damage history, strong claim (+18)
- Permit status Owner-Builder/No Contractor: Owner handling claim alone — ideal target (+22)
- Stalled permit (no inspection >60 days): Owner may be stuck — intervention opportunity (+15)
- Underpayment flag: Permit value below median — likely underpaid by insurer (+18)
- Base score: 25

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

    Mirrors the scoring criteria in build_score_prompt() and is calibrated
    from 120+ real closed claims. Bathroom/Accidental Discharge claims are
    the highest-revenue damage type (65.2% of settlements). Insurer risk
    modifiers are applied based on real payout and litigation history.
    """
    from datetime import date

    score = 25  # base (down from 30 to leave more room for signal differentiation)

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

    # Damage type — reweighted from real outcome data
    damage = lead.get("damage_type", "") or lead.get("damageType", "")
    if damage in ("Accidental Discharge", "Bathroom"):
        score += 30   # 65.2% of all settled claims — highest revenue type
    elif damage in ("Hurricane/Wind",):
        score += 20   # 25.2% of settlements
    elif damage in ("Roof",):
        score += 18
    elif damage in ("Fire", "Structural"):
        score += 15
    elif damage in ("Flood",):
        score += 12

    # Permit scope
    permit_type = (lead.get("permit_type") or lead.get("permitType") or "").lower()
    if any(kw in permit_type for kw in ["replacement", "structural", "foundation", "load-bearing", "full roof"]):
        score += 15

    # Contact info
    if lead.get("contact_email") or lead.get("contact_phone"):
        score += 12
    elif (lead.get("contact") or {}).get("phone") or (lead.get("contact") or {}).get("email"):
        score += 12

    # Storm linkage
    if lead.get("storm_event") or lead.get("stormEvent"):
        score += 10

    # Permit status bonuses
    permit_status = lead.get("permit_status") or lead.get("permitStatus") or "Active"
    if permit_status in ("Owner-Builder", "No Contractor"):
        score += 22   # ideal target — no professional help yet
    elif permit_status == "Stalled":
        score += 15

    # Underpayment flag
    if lead.get("underpaid_flag") or lead.get("underpaidFlag"):
        score += 18   # clear recovery opportunity

    # Repeat damage
    prior = lead.get("prior_permit_count") or lead.get("priorPermitCount") or 0
    if prior >= 1:
        score += 18   # proven claim history = easier settlement

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

    # Insurer risk modifier — data-driven from real closed claims
    insurer = lead.get("insurance_company") or lead.get("insuranceCompany") or ""
    risk_data = get_insurer_risk(insurer)
    if risk_data:
        score += risk_data["score_modifier"]

    return min(max(score, 0), 100)


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
        "damage_type": "Accidental Discharge",
        "permit_type": "Bathroom Water Damage Repair",
        "permit_date": "2026-03-10",
        "storm_event": "",
        "contact_email": "c.mendoza@gmail.com",
        "source": "permit",
        "insurance_company": "Tower Hill",
    }

    score = _algorithmic_score(test_lead)
    print(f"Score: {score}")
    print("\n--- Scoring prompt (used by Claude Code automation) ---")
    print(build_score_prompt(test_lead))
