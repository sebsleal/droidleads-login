"""
Data-driven scoring helpers backed by the sanitized company metrics dataset.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

COMPANY_METRICS_PATH = (
    Path(__file__).resolve().parents[1] / "src" / "data" / "companyMetrics.json"
)

DEFAULT_PERIL_MODIFIERS = {
    # Ranked by EV: P(settled) × avg_settlement from 120+ closed claims
    "Fire":                 12,  # $65K avg settlement, 50% settlement rate
    "Accidental Discharge": 10,  # 58% settlement rate, $48K avg — highest P(settled)
    "Structural":            8,  # $55K avg, strong settlement when it occurs
    "Hurricane/Wind":        6,  # most common type, 45% settlement, $42K avg
    "Roof":                  3,  # 42% settlement rate but lowest avg ($32K)
    "Flood":                 2,  # most complex, 32% settlement rate
}

DEFAULT_INSURER_MODIFIERS = {
    # Ranked by portfolio outcomes: settlement rate × avg payout
    "tower hill":           {"score_modifier":  8, "risk": "low",    "label": "Strong Payer"},
    "progressive":          {"score_modifier":  8, "risk": "low",    "label": "Strong Payer"},
    "universal property":   {"score_modifier":  6, "risk": "low",    "label": "Strong Payer"},
    "universal north america": {"score_modifier": 6, "risk": "low",  "label": "Strong Payer"},
    "florida peninsula":    {"score_modifier":  6, "risk": "low",    "label": "Strong Payer"},
    "cypress":              {"score_modifier":  6, "risk": "low",    "label": "Strong Payer"},
    "homeowners choice":    {"score_modifier":  4, "risk": "low",    "label": "Strong Payer"},
    "monarch national":     {"score_modifier":  4, "risk": "low",    "label": "Strong Payer"},
    "slide":                {"score_modifier":  2, "risk": "medium", "label": "Moderate Payer"},
    "state farm":           {"score_modifier":  0, "risk": "medium", "label": "Moderate Payer"},
    "usaa":                 {"score_modifier":  0, "risk": "medium", "label": "Moderate Payer"},
    "american security":    {"score_modifier":  0, "risk": "medium", "label": "Moderate Payer"},
    "castle key":           {"score_modifier": -2, "risk": "high",   "label": "High Friction"},
    "citizens":             {"score_modifier": -4, "risk": "high",   "label": "High Friction"},
    "integon national":     {"score_modifier": -8, "risk": "high",   "label": "High Friction"},
}


@lru_cache(maxsize=1)
def load_company_metrics() -> dict[str, Any]:
    if not COMPANY_METRICS_PATH.exists():
        return {}
    try:
        return json.loads(COMPANY_METRICS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def get_scoring_model() -> dict[str, Any]:
    return load_company_metrics().get("scoring_model", {})


def get_peril_signal(damage_type: str | None) -> dict[str, Any] | None:
    if not damage_type:
        return None
    peril_weights = get_scoring_model().get("peril_weights", {})
    signal = peril_weights.get(damage_type)
    if signal:
        return signal
    default_modifier = DEFAULT_PERIL_MODIFIERS.get(damage_type)
    if default_modifier is None:
        return None
    return {
        "score_modifier": default_modifier,
        "workflow_priority_bonus": 0,
        "settled_like_rate": 0,
        "litigation_rate": 0,
        "no_pay_rate": 0,
        "expected_fee_per_case": 0,
    }


def get_insurer_risk(insurer_name: str | None) -> dict[str, Any] | None:
    if not insurer_name:
        return None
    lowered = insurer_name.lower().strip()
    insurer_modifiers = get_scoring_model().get("insurer_modifiers", {})
    for insurer_key, payload in insurer_modifiers.items():
        normalized_key = insurer_key.lower().strip()
        if normalized_key in lowered or lowered in normalized_key:
            return payload
    for insurer_key, payload in DEFAULT_INSURER_MODIFIERS.items():
        if insurer_key in lowered or lowered in insurer_key:
            return payload
    return None


def apply_company_signals(lead: dict[str, Any]) -> dict[str, Any]:
    insurer_name = lead.get("insurance_company") or lead.get("insuranceCompany")
    insurer_signal = get_insurer_risk(insurer_name)
    if insurer_signal:
        lead["insurer_risk"] = insurer_signal["risk"]
        lead["insurer_risk_label"] = insurer_signal["label"]
    return lead


def company_context_lines(lead: dict[str, Any]) -> list[str]:
    lines: list[str] = []

    damage_type = lead.get("damage_type") or lead.get("damageType")
    peril_signal = get_peril_signal(damage_type)
    if peril_signal:
        lines.append(
            "- Historical peril signal: "
            f"{damage_type} modifier {peril_signal['score_modifier']} "
            f"(settled {int(peril_signal.get('settled_like_rate', 0) * 100)}%, "
            f"litigation {int(peril_signal.get('litigation_rate', 0) * 100)}%)."
        )

    insurer_name = lead.get("insurance_company") or lead.get("insuranceCompany")
    insurer_signal = get_insurer_risk(insurer_name)
    if insurer_name:
        lines.append(f"- Insurance company: {insurer_name}")
    if insurer_signal:
        lines.append(
            "- Historical insurer signal: "
            f"{insurer_signal['label']} ({insurer_signal['score_modifier']} score modifier, "
            f"litigation {int(insurer_signal.get('litigation_rate', 0) * 100)}%)."
        )

    if lead.get("assessed_value") or lead.get("assessedValue"):
        value = lead.get("assessed_value") or lead.get("assessedValue")
        lines.append(f"- Assessed property value: ${value:,}")
    if lead.get("homestead") is not None:
        lines.append(f"- Homestead: {'Yes' if lead.get('homestead') else 'No'}")
    if lead.get("absentee_owner") is not None or lead.get("absenteeOwner") is not None:
        absentee = lead.get("absentee_owner")
        if absentee is None:
            absentee = lead.get("absenteeOwner")
        lines.append(f"- Absentee owner: {'Yes' if absentee else 'No'}")
    if lead.get("roof_age") or lead.get("roofAge"):
        lines.append(f"- Building age: {lead.get('roof_age') or lead.get('roofAge')} years")
    if lead.get("permit_status") or lead.get("permitStatus"):
        lines.append(
            f"- Permit status: {lead.get('permit_status') or lead.get('permitStatus')}"
        )
    if lead.get("permit_value") or lead.get("permitValue"):
        lines.append(
            f"- Permit value: ${int(lead.get('permit_value') or lead.get('permitValue')):,}"
        )
    if lead.get("underpaid_flag") or lead.get("underpaidFlag"):
        lines.append(
            "- Underpaid signal: permit value is materially below the local median."
        )
    if lead.get("prior_permit_count") or lead.get("priorPermitCount"):
        lines.append(
            "- Repeat-damage signal: "
            f"{lead.get('prior_permit_count') or lead.get('priorPermitCount')} prior permit(s)."
        )

    return lines


def build_score_prompt(lead: dict[str, Any]) -> str:
    metrics = load_company_metrics()
    total_fees = metrics.get("claims_summary", {}).get("total_fee_disbursed", 0)
    top_peril = next(
        iter(metrics.get("claims_summary", {}).get("peril_metrics", [])), {}
    )
    top_insurer = next(
        iter(metrics.get("claims_summary", {}).get("insurer_metrics", [])), {}
    )
    enrichment_context = (
        "\n".join(company_context_lines(lead))
        or "- No additional enrichment data available"
    )

    return f"""You are a lead scoring analyst for Claim Remedy Adjusters.

Use the same hybrid scoring model as the production scraper:
- Base score = 30
- Add the peril modifier from historical company outcomes when available
- Add the insurer modifier when an insurance company is known
- Add operational heuristics for recency, permit scope, contactability, ownership, storm linkage, and underpayment
- Keep the score explainable and bounded to 0-100

Company outcome context from the sanitized internal metrics set:
- Total historical fees in the extract: ${total_fees:,.2f}
- Largest peril family in the extract: {top_peril.get("peril", "Unknown")} ({top_peril.get("sample_size", 0)} files)
- Highest-fee insurer in the extract: {top_insurer.get("insurer", "Unknown")}

Lead details:
- Owner: {lead.get("owner_name") or lead.get("ownerName") or "Unknown"}
- Property: {lead.get("address") or lead.get("propertyAddress") or "Unknown"}, {lead.get("city", "Miami")}, FL {lead.get("zip", "")}
- Damage type: {lead.get("damage_type") or lead.get("damageType") or "Unknown"}
- Permit type: {lead.get("permit_type") or lead.get("permitType") or "Unknown"}
- Permit date: {lead.get("permit_date") or lead.get("permitDate") or "Unknown"}
- Storm event: {lead.get("storm_event") or lead.get("stormEvent") or "None recorded"}
- Source detail: {lead.get("source_detail") or lead.get("sourceDetail") or lead.get("source", "Unknown")}

Derived context:
{enrichment_context}

Respond with ONLY:
{{"score": <integer 0-100>, "reasoning": "<one sentence explanation>"}}
"""


def _score_with_breakdown(lead: dict[str, Any]) -> tuple[int, dict]:
    """Compute score and return (score, breakdown_dict) with per-factor detail."""
    from datetime import date

    score = 30
    factors: list[dict] = []

    def add(delta: int, label: str, note: str = "") -> None:
        nonlocal score
        score += delta
        factors.append({"label": label, "delta": delta, "note": note})

    damage_type = lead.get("damage_type") or lead.get("damageType")
    peril_signal = get_peril_signal(damage_type)
    if peril_signal and int(peril_signal["score_modifier"]) != 0:
        add(int(peril_signal["score_modifier"]), f"{damage_type} damage type",
            "Based on historical settlement rate & avg payout from closed claims")

    insurer_name = lead.get("insurance_company") or lead.get("insuranceCompany")
    insurer_signal = get_insurer_risk(insurer_name)
    if insurer_signal and int(insurer_signal["score_modifier"]) != 0:
        label = insurer_name if insurer_name else "Known insurer"
        add(int(insurer_signal["score_modifier"]), f"Insurer: {label}",
            insurer_signal.get("label", ""))

    try:
        permit_date = date.fromisoformat(
            str(lead.get("permit_date") or lead.get("permitDate") or "")
        )
        days_ago = (date.today() - permit_date).days
        if days_ago <= 30:
            add(18, "Permit filed within 30 days", "Fresh damage — highest urgency")
        elif days_ago <= 60:
            add(10, "Permit filed within 60 days", "Recent damage — high urgency")
        elif days_ago <= 90:
            add(4, "Permit filed within 90 days", "Moderate recency")
    except ValueError:
        pass

    permit_type = (lead.get("permit_type") or lead.get("permitType") or "").lower()
    if any(kw in permit_type for kw in ["replacement", "structural", "foundation", "full roof", "mitigation"]):
        add(12, "Major permit scope", f'"{permit_type}" indicates full replacement or structural work')
    elif "repair" in permit_type or "roof" in permit_type:
        add(6, "Repair/roof permit", f'"{permit_type}" indicates repair-level work')

    has_contact = (
        lead.get("contact_email") or lead.get("contact_phone")
        or (lead.get("contact") or {}).get("email")
        or (lead.get("contact") or {}).get("phone")
    )
    if has_contact:
        add(12, "Contact info available", "Owner can be reached directly")

    if lead.get("storm_event") or lead.get("stormEvent"):
        add(8, "Linked to storm event", "Permit correlates with a named storm or weather event")

    source_detail = lead.get("source_detail") or lead.get("sourceDetail")
    if source_detail == "storm_first":
        add(6, "Storm-first lead", "Storm preceded the permit — strong insurance claim signal")

    permit_status = lead.get("permit_status") or lead.get("permitStatus") or "Active"
    if permit_status in {"Owner-Builder", "No Contractor"}:
        add(18, f"Permit status: {permit_status}", "No licensed contractor — owner likely underpaid or self-managing")
    elif permit_status == "Stalled":
        add(12, "Permit stalled", "Work halted — possible underpayment or dispute")

    if lead.get("underpaid_flag") or lead.get("underpaidFlag"):
        add(10, "Underpayment flag", "Permit value below local median — owner may have accepted a low settlement")

    prior_permit_count = lead.get("prior_permit_count") or lead.get("priorPermitCount") or 0
    if prior_permit_count >= 1:
        add(8, f"Repeat damage ({prior_permit_count} prior permit{'s' if prior_permit_count > 1 else ''})",
            "Multiple claims history — likely still under-indemnified")

    if lead.get("homestead"):
        add(6, "Homesteaded property", "Primary residence — owner has personal stake in outcome")

    if lead.get("absentee_owner") or lead.get("absenteeOwner"):
        add(8, "Absentee owner", "Owner not on-site — property may be under-managed and underclaimed")

    roof_age = lead.get("roof_age") or lead.get("roofAge") or 0
    if roof_age and roof_age > 15:
        add(8, f"Aging building ({roof_age} yrs)", "Older structure increases damage severity and claim potential")

    if lead.get("fema_declaration_number") or lead.get("femaDeclarationNumber"):
        decl = lead.get("fema_declaration_number") or lead.get("femaDeclarationNumber")
        add(6, f"FEMA declaration ({decl})", "Federally declared disaster area — strengthens claim basis")

    assessed = lead.get("assessed_value") or lead.get("assessedValue") or 0
    try:
        assessed = float(assessed)
        if assessed >= 600_000:
            add(8, f"High-value property (${assessed:,.0f})", "Higher assessed value = larger potential claim & PA fee")
        elif assessed >= 300_000:
            add(4, f"Mid-value property (${assessed:,.0f})", "Above-median assessed value")
    except (TypeError, ValueError):
        pass

    permit_value = lead.get("permit_value") or lead.get("permitValue") or 0
    try:
        permit_value = float(permit_value)
        if permit_value >= 50_000:
            add(6, f"Large permit scope (${permit_value:,.0f})", "Documented damage cost suggests significant underpayment exposure")
        elif permit_value >= 20_000:
            add(3, f"Moderate permit scope (${permit_value:,.0f})", "Non-trivial documented repair cost")
    except (TypeError, ValueError):
        pass

    total = min(max(score, 0), 100)
    breakdown = {"base": 30, "factors": factors, "total": total}
    return total, breakdown


def _algorithmic_score(lead: dict[str, Any]) -> int:
    score, _ = _score_with_breakdown(lead)
    return score


def score_leads_batch(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for lead in leads:
        lead = apply_company_signals({**lead})
        score, breakdown = _score_with_breakdown(lead)
        lead["score"] = score
        lead["score_breakdown"] = breakdown
        lead["score_reasoning"] = "Hybrid score from company outcomes plus operational heuristics."
        result.append(lead)
    return result
