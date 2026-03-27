from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import median as stat_median
from typing import Any

from enrichment.outreach_prompt import generate_outreach_batch, is_template_message
from enrichment.score_prompt import _score_with_breakdown, apply_company_signals
from scrapers.dedup import make_hash
from scrapers.fema import build_fema_windows, fetch_fl_declarations, match_fema
from scrapers.parcels import MIAMI_DADE_ZIPS, fetch_parcels_by_zip
from scrapers.permits import COUNTY_CONFIGS, scrape_damage_permits
from scrapers.property import enrich_leads_with_owner_info
from scrapers.storms import scrape_storm_events

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEADS_OUTPUT_PATH = PROJECT_ROOT / "public" / "leads.json"

SOURCE_PRIORITY = {
    "permit": 3,
    "storm_first": 2,
    "storm_event": 1,
}

TRACKING_FIELDS = {
    "status",
    "contacted_at",
    "converted_at",
    "claim_value",
    "contact_method",
    "notes",
}

STATE_FIELDS = TRACKING_FIELDS | {
    "id",
    "outreach_message",
    "enriched_at",
    "owner_name",
    "owner_mailing_address",
    "assessed_value",
    "homestead",
    "roof_age",
    "absentee_owner",
    "contact_email",
    "contact_phone",
    "insurance_company",
    "insurer_risk",
    "insurer_risk_label",
}


@dataclass
class LeadPipelineResult:
    leads: list[dict[str, Any]]
    permit_count: int
    storm_count: int
    pre_permit_count: int
    fema_tagged_count: int
    county_counts: dict[str, int]


def canonical_source_detail(
    raw_source: str | None, raw_detail: str | None = None
) -> tuple[str, str]:
    detail = (raw_detail or "").strip()
    source = (raw_source or "").strip()
    if detail:
        canonical_source = (
            "storm" if detail in {"storm_event", "storm_first"} else "permit"
        )
        return canonical_source, detail
    if source == "storm-first":
        return "storm", "storm_first"
    if source == "storm":
        return "storm", "storm_event"
    return "permit", "permit"


def canonical_damage_type(raw: str | None) -> str:
    value = (raw or "").strip()
    lowered = value.lower()
    if lowered in {
        "bathroom",
        "bath",
        "m bath",
        "h bath",
        "hall bath",
        "plumbing failure",
        "pipe break",
        "a/c leak",
        "ac leak",
    }:
        return "Accidental Discharge"
    if lowered in {"water mold", "plumbing mold", "bathroom mold"}:
        return "Accidental Discharge"
    if lowered in {"wind/rain", "hurricane", "milton", "ian", "hail"}:
        return "Hurricane/Wind"
    if lowered == "roof leak":
        return "Roof"
    return value or "Roof"


def canonicalize_lead(raw: dict[str, Any]) -> dict[str, Any]:
    source, source_detail = canonical_source_detail(
        raw.get("source"), raw.get("source_detail")
    )
    address = (raw.get("address") or raw.get("propertyAddress") or "").strip()
    permit_date = (raw.get("permit_date") or raw.get("permitDate") or "").strip()
    dedup_hash = raw.get("dedup_hash") or make_hash(address, permit_date)
    lead = {
        "id": raw.get("id") or dedup_hash,
        "dedup_hash": dedup_hash,
        "owner_name": (
            raw.get("owner_name") or raw.get("ownerName") or "Property Owner"
        ).strip()
        or "Property Owner",
        "address": address,
        "city": (raw.get("city") or "Miami").strip() or "Miami",
        "zip": (raw.get("zip") or "").strip(),
        "folio_number": (
            raw.get("folio_number") or raw.get("folioNumber") or ""
        ).strip(),
        "damage_type": canonical_damage_type(
            raw.get("damage_type") or raw.get("damageType")
        ),
        "permit_type": (raw.get("permit_type") or raw.get("permitType") or "").strip(),
        "permit_date": permit_date,
        "storm_event": (raw.get("storm_event") or raw.get("stormEvent") or "").strip(),
        "lead_date": (
            raw.get("lead_date")
            or permit_date
            or datetime.now(timezone.utc).date().isoformat()
        ),
        "score": int(raw.get("score") or 0),
        "status": raw.get("status") or "New",
        "source": source,
        "source_detail": source_detail,
        "contact_email": raw.get("contact_email")
        or ((raw.get("contact") or {}).get("email")),
        "contact_phone": raw.get("contact_phone")
        or ((raw.get("contact") or {}).get("phone")),
        "outreach_message": raw.get("outreach_message")
        or raw.get("outreachMessage")
        or "",
        "score_reasoning": raw.get("score_reasoning")
        or raw.get("scoreReasoning")
        or "",
        "contacted_at": raw.get("contacted_at") or raw.get("contactedAt"),
        "converted_at": raw.get("converted_at") or raw.get("convertedAt"),
        "claim_value": raw.get("claim_value") or raw.get("claimValue"),
        "contact_method": raw.get("contact_method") or raw.get("contactMethod"),
        "notes": raw.get("notes"),
        "noaa_episode_id": raw.get("noaa_episode_id"),
        "noaa_event_id": raw.get("noaa_event_id"),
        "county": raw.get("county") or "miami-dade",
        "fema_declaration_number": raw.get("fema_declaration_number")
        or raw.get("femaDeclarationNumber"),
        "fema_incident_type": raw.get("fema_incident_type")
        or raw.get("femaIncidentType"),
        "homestead": raw.get("homestead"),
        "owner_mailing_address": raw.get("owner_mailing_address")
        or raw.get("ownerMailingAddress"),
        "assessed_value": raw.get("assessed_value") or raw.get("assessedValue"),
        "permit_status": raw.get("permit_status") or raw.get("permitStatus"),
        "contractor_name": raw.get("contractor_name") or raw.get("contractorName"),
        "permit_value": raw.get("permit_value") or raw.get("permitValue") or 0,
        "underpaid_flag": bool(raw.get("underpaid_flag") or raw.get("underpaidFlag")),
        "absentee_owner": raw.get("absentee_owner")
        if "absentee_owner" in raw
        else raw.get("absenteeOwner"),
        "prior_permit_count": raw.get("prior_permit_count")
        or raw.get("priorPermitCount")
        or 0,
        "roof_age": raw.get("roof_age") or raw.get("roofAge"),
        "insurance_company": raw.get("insurance_company")
        or raw.get("insuranceCompany"),
        "insurer_risk": raw.get("insurer_risk") or raw.get("insurerRisk"),
        "insurer_risk_label": raw.get("insurer_risk_label")
        or raw.get("insurerRiskLabel"),
        "enriched_at": raw.get("enriched_at") or raw.get("enrichedAt"),
        "narrative": raw.get("narrative"),
    }
    return lead


def compute_underpayment_flags(leads: list[dict[str, Any]]) -> None:
    groups: dict[tuple[str, str], list[float]] = {}
    for lead in leads:
        permit_value = float(lead.get("permit_value") or 0)
        if permit_value <= 500:
            continue
        key = ((lead.get("city") or "").lower(), lead.get("damage_type") or "")
        groups.setdefault(key, []).append(permit_value)

    medians = {
        key: stat_median(values) for key, values in groups.items() if len(values) >= 3
    }

    for lead in leads:
        key = ((lead.get("city") or "").lower(), lead.get("damage_type") or "")
        permit_value = float(lead.get("permit_value") or 0)
        median_value = medians.get(key)
        lead["underpaid_flag"] = bool(
            median_value and permit_value > 500 and permit_value < median_value * 0.6
        )


def compute_repeat_damage(leads: list[dict[str, Any]]) -> None:
    folio_counts = Counter(
        lead["folio_number"] for lead in leads if lead.get("folio_number")
    )
    for lead in leads:
        count = folio_counts.get(lead.get("folio_number") or "", 1)
        lead["prior_permit_count"] = max(0, count - 1)


def merge_existing_state(
    leads: list[dict[str, Any]],
    existing_by_hash: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for lead in leads:
        existing = existing_by_hash.get(lead["dedup_hash"])
        if not existing:
            merged.append(lead)
            continue

        if existing.get("id"):
            lead["id"] = existing["id"]

        for field in TRACKING_FIELDS:
            if existing.get(field) not in {None, ""}:
                lead[field] = existing[field]

        for field in (
            "owner_name",
            "owner_mailing_address",
            "assessed_value",
            "homestead",
            "roof_age",
            "absentee_owner",
            "contact_email",
            "contact_phone",
            "insurance_company",
            "insurer_risk",
            "insurer_risk_label",
        ):
            if not lead.get(field) and existing.get(field) not in {None, ""}:
                lead[field] = existing[field]

        existing_message = existing.get("outreach_message") or ""
        if existing_message and not is_template_message(existing_message):
            lead["outreach_message"] = existing_message
            lead["enriched_at"] = existing.get("enriched_at")

        merged.append(lead)
    return merged


def load_existing_state_from_json(
    path: Path = DEFAULT_LEADS_OUTPUT_PATH,
) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    rows = payload.get("leads") or []
    existing: dict[str, dict[str, Any]] = {}
    for row in rows:
        canonical = canonicalize_lead(row)
        canonical["dedup_hash"] = row.get("dedupHash") or canonical["dedup_hash"]
        existing[canonical["dedup_hash"]] = canonical
    return existing


def load_existing_state_from_db(
    supabase: Any, dedup_hashes: list[str]
) -> dict[str, dict[str, Any]]:
    if not supabase or not dedup_hashes:
        return {}
    rows: list[dict[str, Any]] = []
    try:
        for start in range(0, len(dedup_hashes), 150):
            batch = dedup_hashes[start : start + 150]
            response = (
                supabase.table("leads").select("*").in_("dedup_hash", batch).execute()
            )
            rows.extend(response.data or [])
    except Exception as exc:
        print(f"[lead-pipeline] Could not load existing lead state from DB: {exc}")
        return {}
    return {
        row["dedup_hash"]: canonicalize_lead(row)
        for row in rows
        if row.get("dedup_hash")
    }


def deduplicate_canonical_leads(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    exact_dedup: dict[str, dict[str, Any]] = {}
    for lead in leads:
        existing = exact_dedup.get(lead["dedup_hash"])
        if existing is None:
            exact_dedup[lead["dedup_hash"]] = lead
            continue

        existing_priority = SOURCE_PRIORITY.get(existing["source_detail"], 0)
        current_priority = SOURCE_PRIORITY.get(lead["source_detail"], 0)
        existing_signal = int(
            bool(existing.get("contact_phone") or existing.get("contact_email"))
        )
        current_signal = int(
            bool(lead.get("contact_phone") or lead.get("contact_email"))
        )

        if (current_priority, current_signal) > (existing_priority, existing_signal):
            exact_dedup[lead["dedup_hash"]] = lead

    by_folio: dict[str, list[dict[str, Any]]] = {}
    for lead in exact_dedup.values():
        folio = lead.get("folio_number") or ""
        if folio:
            by_folio.setdefault(folio, []).append(lead)

    dropped_hashes: set[str] = set()
    for bucket in by_folio.values():
        has_permit = any(item["source_detail"] == "permit" for item in bucket)
        if not has_permit:
            continue
        for item in bucket:
            if item["source_detail"] == "storm_first":
                dropped_hashes.add(item["dedup_hash"])

    deduped = [
        lead
        for dedup_hash, lead in exact_dedup.items()
        if dedup_hash not in dropped_hashes
    ]
    print(
        f"[lead-pipeline] {len(leads)} raw leads -> {len(deduped)} canonical leads after dedup"
    )
    return deduped


def build_pre_permit_leads(
    storm_leads: list[dict[str, Any]],
    permit_leads: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    miami_dade_storms = [
        lead for lead in storm_leads if lead.get("county") == "miami-dade"
    ]
    if not miami_dade_storms:
        return []

    latest_storm = max(
        miami_dade_storms, key=lambda lead: lead.get("permit_date") or ""
    )
    event_date = (
        latest_storm.get("permit_date") or datetime.now(timezone.utc).date().isoformat()
    )
    existing_addresses = {
        (lead.get("address") or "").lower().strip()
        for lead in permit_leads
        if lead.get("address")
    }

    parcels = fetch_parcels_by_zip(MIAMI_DADE_ZIPS[:5], limit_per_zip=20)
    pre_permit: list[dict[str, Any]] = []
    for parcel in parcels:
        address = (parcel.get("propertyAddress") or "").strip()
        if not address:
            continue
        normalized_address = address.lower().strip()
        if normalized_address in existing_addresses:
            continue

        pre_permit.append(
            canonicalize_lead(
                {
                    "owner_name": "Property Owner",
                    "address": address,
                    "city": "Miami",
                    "zip": parcel.get("zip", "33101"),
                    "folio_number": parcel.get("folioNumber", ""),
                    "damage_type": latest_storm.get("damage_type", "Hurricane/Wind"),
                    "permit_type": "Pre-Permit Storm Opportunity",
                    "permit_date": event_date,
                    "storm_event": latest_storm.get("storm_event", ""),
                    "status": "New",
                    "source": "storm",
                    "source_detail": "storm_first",
                    "county": "miami-dade",
                    "fema_declaration_number": latest_storm.get(
                        "fema_declaration_number"
                    ),
                    "fema_incident_type": latest_storm.get("fema_incident_type"),
                }
            )
        )
    return pre_permit


def apply_fema_enrichment(
    leads: list[dict[str, Any]], fema_windows: list[dict[str, Any]]
) -> int:
    fema_enriched = 0
    for lead in leads:
        match = match_fema(
            lead.get("permit_date", ""), lead.get("county", "miami-dade"), fema_windows
        )
        if not match:
            continue
        lead["fema_declaration_number"] = match["fema_number"]
        lead["fema_incident_type"] = match["incident_type"]
        if not lead.get("storm_event"):
            lead["storm_event"] = match["label"]
        fema_enriched += 1
    return fema_enriched


def sort_leads(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        leads,
        key=lambda lead: (
            lead.get("score") or 0,
            lead.get("permit_date") or "",
            lead.get("address") or "",
        ),
        reverse=True,
    )


def serialize_lead_for_ui(lead: dict[str, Any]) -> dict[str, Any]:
    contact = {}
    if lead.get("contact_email"):
        contact["email"] = lead["contact_email"]
    if lead.get("contact_phone"):
        contact["phone"] = lead["contact_phone"]

    payload = {
        "id": lead["id"],
        "ownerName": lead.get("owner_name") or "Property Owner",
        "propertyAddress": lead.get("address") or "",
        "city": lead.get("city") or "Miami",
        "zip": lead.get("zip") or "",
        "folioNumber": lead.get("folio_number") or "",
        "damageType": lead.get("damage_type") or "Roof",
        "score": int(lead.get("score") or 0),
        "date": lead.get("permit_date") or lead.get("lead_date") or "",
        "status": lead.get("status") or "New",
        "permitType": lead.get("permit_type") or "",
        "permitDate": lead.get("permit_date") or "",
        "stormEvent": lead.get("storm_event") or "",
        "outreachMessage": lead.get("outreach_message") or "",
        "scoreReasoning": lead.get("score_reasoning") or "",
        "scoreBreakdown": lead.get("score_breakdown"),
        "source": lead.get("source") or "permit",
        "sourceDetail": lead.get("source_detail") or "permit",
        "contactedAt": lead.get("contacted_at"),
        "convertedAt": lead.get("converted_at"),
        "claimValue": lead.get("claim_value"),
        "contactMethod": lead.get("contact_method"),
        "notes": lead.get("notes"),
        "homestead": lead.get("homestead"),
        "ownerMailingAddress": lead.get("owner_mailing_address"),
        "assessedValue": lead.get("assessed_value"),
        "permitStatus": lead.get("permit_status"),
        "contractorName": lead.get("contractor_name"),
        "permitValue": lead.get("permit_value"),
        "underpaidFlag": lead.get("underpaid_flag"),
        "absenteeOwner": lead.get("absentee_owner"),
        "priorPermitCount": lead.get("prior_permit_count"),
        "roofAge": lead.get("roof_age"),
        "county": lead.get("county"),
        "femaDeclarationNumber": lead.get("fema_declaration_number"),
        "femaIncidentType": lead.get("fema_incident_type"),
        "insuranceCompany": lead.get("insurance_company"),
        "insurerRisk": lead.get("insurer_risk"),
        "insurerRiskLabel": lead.get("insurer_risk_label"),
        "dedupHash": lead.get("dedup_hash"),
        "registeredAgentName": lead.get("registered_agent_name"),
        "registeredAgentAddress": lead.get("registered_agent_address"),
        "llcOfficers": lead.get("llc_officers") or [],
    }
    if contact:
        payload["contact"] = contact
    return payload


def write_leads_json(
    leads: list[dict[str, Any]], output_path: Path = DEFAULT_LEADS_OUTPUT_PATH
) -> dict[str, Any]:
    ui_leads = [serialize_lead_for_ui(lead) for lead in sort_leads(leads)]
    payload = {
        "leads": ui_leads,
        "lastScraped": datetime.now(timezone.utc).isoformat(),
        "count": len(ui_leads),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def build_canonical_lead_dataset(supabase: Any | None = None) -> LeadPipelineResult:
    permit_leads: list[dict[str, Any]] = []
    for county, config in COUNTY_CONFIGS.items():
        if not config.get("enabled"):
            continue
        try:
            permit_leads.extend(
                canonicalize_lead(lead)
                for lead in scrape_damage_permits(county=county, max_records=5000, lookback_days=365)
            )
        except Exception as exc:
            print(f"[lead-pipeline] Permit scrape failed for {county}: {exc}")

    storm_leads: list[dict[str, Any]] = []
    try:
        current_year = datetime.now(timezone.utc).year
        storm_leads = [
            canonicalize_lead(lead)
            for lead in scrape_storm_events(years=[current_year - 1, current_year])
        ]
    except Exception as exc:
        print(f"[lead-pipeline] Storm scrape failed: {exc}")

    try:
        fema_windows = build_fema_windows(fetch_fl_declarations(lookback_years=3))
    except Exception as exc:
        print(f"[lead-pipeline] FEMA fetch failed: {exc}")
        fema_windows = []

    pre_permit_leads: list[dict[str, Any]] = []
    try:
        pre_permit_leads = build_pre_permit_leads(
            storm_leads=storm_leads, permit_leads=permit_leads
        )
    except Exception as exc:
        print(f"[lead-pipeline] Pre-permit lead build failed: {exc}")

    all_leads = permit_leads + storm_leads + pre_permit_leads
    if not all_leads:
        return LeadPipelineResult([], 0, 0, 0, 0, {})

    fema_tagged_count = (
        apply_fema_enrichment(all_leads, fema_windows) if fema_windows else 0
    )

    try:
        all_leads = enrich_leads_with_owner_info(all_leads, max_lookups=300)
    except Exception as exc:
        print(f"[lead-pipeline] Owner enrichment failed: {exc}")

    all_leads = deduplicate_canonical_leads(all_leads)
    compute_underpayment_flags(all_leads)
    compute_repeat_damage(all_leads)

    for lead in all_leads:
        apply_company_signals(lead)
        lead["score"], lead["score_breakdown"] = _score_with_breakdown(lead)

    all_leads = sort_leads(all_leads)

    try:
        from scrapers.sunbiz import enrich_business_owners
        from scrapers.voter_lookup import enrich_with_voter_data

        all_leads = enrich_business_owners(all_leads, top_n=20, delay=2.0)
        all_leads = enrich_with_voter_data(all_leads, top_n=200)
        for lead in all_leads:
            apply_company_signals(lead)
            lead["score"], lead["score_breakdown"] = _score_with_breakdown(lead)
        all_leads = sort_leads(all_leads)
    except Exception as exc:
        print(f"[lead-pipeline] Contact enrichment failed: {exc}")

    dedup_hashes = [lead["dedup_hash"] for lead in all_leads]
    existing_state = (
        load_existing_state_from_db(supabase, dedup_hashes) if supabase else {}
    )
    if not existing_state:
        existing_state = load_existing_state_from_json()
    all_leads = merge_existing_state(all_leads, existing_state)

    all_leads = generate_outreach_batch(all_leads)
    all_leads = sort_leads(all_leads)

    county_counts = Counter(lead.get("county") or "miami-dade" for lead in all_leads)
    return LeadPipelineResult(
        leads=all_leads,
        permit_count=len(permit_leads),
        storm_count=len(storm_leads),
        pre_permit_count=len(pre_permit_leads),
        fema_tagged_count=fema_tagged_count,
        county_counts=dict(sorted(county_counts.items())),
    )
