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
    "Accidental Discharge": 10,
    "Hurricane/Wind": 3,
    "Flood": 2,
    "Roof": 1,
    "Fire": 4,
    "Structural": 4,
}

DEFAULT_INSURER_MODIFIERS = {
    "tower hill": {"score_modifier": 8, "risk": "low", "label": "Strong Payer"},
    "progressive": {"score_modifier": 8, "risk": "low", "label": "Strong Payer"},
    "citizens": {"score_modifier": 0, "risk": "high", "label": "High Friction"},
    "state farm": {"score_modifier": -2, "risk": "high", "label": "High Friction"},
    "integon national": {
        "score_modifier": -6,
        "risk": "high",
        "label": "High Friction",
    },
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


def _algorithmic_score(lead: dict[str, Any]) -> int:
    from datetime import date

    score = 30

    damage_type = lead.get("damage_type") or lead.get("damageType")
    peril_signal = get_peril_signal(damage_type)
    if peril_signal:
        score += int(peril_signal["score_modifier"])

    insurer_name = lead.get("insurance_company") or lead.get("insuranceCompany")
    insurer_signal = get_insurer_risk(insurer_name)
    if insurer_signal:
        score += int(insurer_signal["score_modifier"])

    try:
        permit_date = date.fromisoformat(
            str(lead.get("permit_date") or lead.get("permitDate") or "")
        )
        days_ago = (date.today() - permit_date).days
        if days_ago <= 30:
            score += 18
        elif days_ago <= 60:
            score += 10
        elif days_ago <= 90:
            score += 4
    except ValueError:
        pass

    permit_type = (lead.get("permit_type") or lead.get("permitType") or "").lower()
    if any(
        keyword in permit_type
        for keyword in [
            "replacement",
            "structural",
            "foundation",
            "full roof",
            "mitigation",
        ]
    ):
        score += 12
    elif "repair" in permit_type or "roof" in permit_type:
        score += 6

    if lead.get("contact_email") or lead.get("contact_phone"):
        score += 12
    elif (lead.get("contact") or {}).get("email") or (lead.get("contact") or {}).get(
        "phone"
    ):
        score += 12

    if lead.get("storm_event") or lead.get("stormEvent"):
        score += 8

    source_detail = lead.get("source_detail") or lead.get("sourceDetail")
    if source_detail == "storm_first":
        score += 6

    permit_status = lead.get("permit_status") or lead.get("permitStatus") or "Active"
    if permit_status in {"Owner-Builder", "No Contractor"}:
        score += 18
    elif permit_status == "Stalled":
        score += 12

    if lead.get("underpaid_flag") or lead.get("underpaidFlag"):
        score += 10

    prior_permit_count = (
        lead.get("prior_permit_count") or lead.get("priorPermitCount") or 0
    )
    if prior_permit_count >= 1:
        score += 8

    if lead.get("homestead"):
        score += 6

    if lead.get("absentee_owner") or lead.get("absenteeOwner"):
        score += 8

    roof_age = lead.get("roof_age") or lead.get("roofAge") or 0
    if roof_age and roof_age > 15:
        score += 8

    if lead.get("fema_declaration_number") or lead.get("femaDeclarationNumber"):
        score += 6

    return min(max(score, 0), 100)


def score_leads_batch(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            **apply_company_signals({**lead}),
            "score": _algorithmic_score(lead),
            "score_reasoning": "Hybrid score from company outcomes plus operational heuristics.",
        }
        for lead in leads
    ]
