"""
Supabase upsert helper for leads.

Uses dedup_hash as the conflict target so re-running the scraper
never creates duplicate rows. On conflict, it refreshes canonical lead data
while preserving user-entered tracking fields unless the incoming payload
explicitly carries a real replacement value.
"""

import os
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


def get_client() -> Client:
    """Return an initialised Supabase client."""
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before using db.insert"
        )
    return create_client(supabase_url, service_role_key)


def upsert_leads(
    leads: list[dict[str, Any]],
    supabase: Client | None = None,
) -> dict[str, int]:
    """
    Upsert a list of lead dicts into the Supabase `leads` table.

    Conflict resolution is on the `dedup_hash` column. Existing rows are
    refreshed with canonical scraper data, but user-entered tracking fields
    are preserved unless the incoming payload explicitly provides a non-empty
    replacement value.

    Args:
        leads: List of lead dicts with all required fields.
        supabase: Optional pre-built Supabase client (created if not provided).

    Returns:
        Dict with keys 'inserted' and 'updated' counts (approximate — Supabase
        upsert does not distinguish them, so both reflect total rows processed).
    """
    if not leads:
        return {"inserted": 0, "updated": 0}

    if supabase is None:
        supabase = get_client()

    # Map lead dicts to DB column names.
    # USER-PROTECTED fields (contacted_at, converted_at, claim_value,
    # contact_method, notes, status) are only included in the payload when
    # the incoming lead actually carries a non-null value.  Combined with
    # default_to_null=False on the upsert call, this ensures that a scraper
    # re-run never overwrites data that an adjuster has manually entered.
    rows = []
    for lead in leads:

        def pick(*keys: str):
            for key in keys:
                if key in lead:
                    value = lead.get(key)
                    if value is not None and value != "":
                        return value
            return None

        row: dict = {
            "id": lead.get("id") or lead.get("dedup_hash"),
            "dedup_hash": lead["dedup_hash"],
            "owner_name": lead.get("owner_name") or "Property Owner",
            "address": lead.get("address") or lead.get("propertyAddress") or "",
            "city": lead.get("city") or "Miami",
            "zip": lead.get("zip") or "33101",
            "folio_number": lead.get("folio_number") or lead.get("folioNumber") or "",
            "damage_type": lead.get("damage_type") or lead.get("damageType") or "Roof",
            "permit_type": lead.get("permit_type") or lead.get("permitType") or "",
            "permit_date": lead.get("permit_date") or lead.get("permitDate") or None,
            "storm_event": lead.get("storm_event") or lead.get("stormEvent") or "",
            "score": lead.get("score") or 30,
            "source": lead.get("source") or "permit",
            "source_detail": lead.get("source_detail")
            or lead.get("sourceDetail")
            or "permit",
            "contact_email": lead.get("contact_email") or None,
            "contact_phone": lead.get("contact_phone") or None,
            "outreach_message": lead.get("outreach_message")
            or lead.get("outreachMessage")
            or "",
            "score_reasoning": pick("score_reasoning", "scoreReasoning"),
            "noaa_episode_id": lead.get("noaa_episode_id") or None,
            "noaa_event_id": lead.get("noaa_event_id") or None,
            # Multi-county + FEMA fields
            "county": lead.get("county") or "miami-dade",
            "fema_declaration_number": lead.get("fema_declaration_number") or None,
            "fema_incident_type": lead.get("fema_incident_type") or None,
            "homestead": lead.get("homestead"),
            "owner_mailing_address": pick(
                "owner_mailing_address", "ownerMailingAddress"
            ),
            "assessed_value": pick("assessed_value", "assessedValue"),
            "permit_status": pick("permit_status", "permitStatus"),
            "contractor_name": pick("contractor_name", "contractorName"),
            "permit_value": pick("permit_value", "permitValue"),
            "underpaid_flag": pick("underpaid_flag", "underpaidFlag"),
            "absentee_owner": pick("absentee_owner", "absenteeOwner"),
            "prior_permit_count": pick("prior_permit_count", "priorPermitCount"),
            "roof_age": pick("roof_age", "roofAge"),
            "insurance_company": pick("insurance_company", "insuranceCompany"),
            "insurer_risk": pick("insurer_risk", "insurerRisk"),
            "insurer_risk_label": pick("insurer_risk_label", "insurerRiskLabel"),
        }

        # Enrichment fields — only include when non-None so that
        # default_to_null=False preserves existing DB values on re-runs.
        if lead.get("expected_value") is not None:
            row["expected_value"] = lead["expected_value"]
        if lead.get("score_breakdown") is not None:
            row["score_breakdown"] = lead["score_breakdown"]
        _outreach_sent_at = pick("outreach_sent_at", "outreachSentAt")
        if _outreach_sent_at is not None:
            row["outreach_sent_at"] = _outreach_sent_at

        # Only include user-protected fields when they carry a real value so
        # that default_to_null=False can preserve whatever the adjuster set
        # in a previous session.
        _user_fields = {
            "status": lead.get("status"),
            "contacted_at": pick("contacted_at", "contactedAt"),
            "converted_at": pick("converted_at", "convertedAt"),
            "claim_value": pick("claim_value", "claimValue"),
            "contact_method": pick("contact_method", "contactMethod"),
            "notes": pick("notes"),
        }
        for col, val in _user_fields.items():
            if val is not None and val != "":
                row[col] = val

        rows.append(row)

    try:
        response = (
            supabase.table("leads")
            .upsert(
                rows,
                on_conflict="dedup_hash",
                ignore_duplicates=False,
                # Columns absent from the payload keep their existing DB value
                # instead of being set to NULL — this is what protects user data.
                default_to_null=False,
            )
            .execute()
        )
        count = len(response.data) if response.data else 0
        print(f"[insert] Upserted {count} leads")
        return {"inserted": count, "updated": 0}

    except Exception as e:
        print(f"[insert] Upsert error: {e}")
        raise


def fetch_existing_hashes(supabase: Client | None = None) -> set[str]:
    """
    Return a set of dedup_hash values already in the database.
    Used upstream by the dedup step to avoid re-processing known leads.
    """
    if supabase is None:
        supabase = get_client()

    try:
        response = supabase.table("leads").select("dedup_hash").execute()
        return {
            row["dedup_hash"] for row in (response.data or []) if row.get("dedup_hash")
        }
    except Exception as e:
        print(f"[insert] Could not fetch existing hashes: {e}")
        return set()


if __name__ == "__main__":
    # Quick smoke test with a synthetic lead
    from scrapers.dedup import make_hash

    test_lead = {
        "address": "1427 SW 8th St",
        "city": "Miami",
        "zip": "33135",
        "owner_name": "Mendoza",
        "folio_number": "01-4109-012-0450",
        "damage_type": "Hurricane/Wind",
        "permit_type": "Roof Replacement",
        "permit_date": "2026-03-10",
        "storm_event": "Hurricane Helene (Sept 2025)",
        "score": 94,
        "status": "New",
        "source": "permit",
        "outreach_message": "TEMPLATE: Dear Mendoza...",
    }
    test_lead["dedup_hash"] = make_hash(test_lead["address"], test_lead["permit_date"])

    result = upsert_leads([test_lead])
    print(result)
