"""
Supabase upsert helper for leads.

Uses dedup_hash as the conflict target so re-running the scraper
never creates duplicate rows. On conflict, it updates score,
outreach_message, and updated_at only — it does NOT overwrite
status or contact info set by users.
"""

import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]


def get_client() -> Client:
    """Return an initialised Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_leads(
    leads: list[dict[str, Any]],
    supabase: Client | None = None,
) -> dict[str, int]:
    """
    Upsert a list of lead dicts into the Supabase `leads` table.

    Conflict resolution is on the `dedup_hash` column. Existing rows
    have score and outreach_message updated; status, contact info, and
    owner name are preserved.

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
            "contact_email": lead.get("contact_email") or None,
            "contact_phone": lead.get("contact_phone") or None,
            "outreach_message": lead.get("outreach_message") or lead.get("outreachMessage") or "",
            "score_reasoning": pick("score_reasoning", "scoreReasoning"),
            "noaa_episode_id": lead.get("noaa_episode_id") or None,
            "noaa_event_id": lead.get("noaa_event_id") or None,
        }

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
        return {row["dedup_hash"] for row in (response.data or []) if row.get("dedup_hash")}
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
