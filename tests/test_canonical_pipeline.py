from __future__ import annotations

import unittest
from unittest.mock import patch

from enrichment.outreach_prompt import (
    generate_outreach_batch,
    needs_outreach_enrichment,
)
from pipeline.leads import (
    build_pre_permit_leads,
    canonicalize_lead,
    deduplicate_canonical_leads,
    merge_existing_state,
)


class CanonicalPipelineTests(unittest.TestCase):
    def test_canonicalize_lead_normalizes_source_and_damage_type(self) -> None:
        lead = canonicalize_lead(
            {
                "address": "123 Example St",
                "city": "Miami",
                "zip": "33101",
                "permit_date": "2025-10-01",
                "source": "storm-first",
                "damage_type": "Bathroom",
            }
        )

        self.assertEqual(lead["source"], "storm")
        self.assertEqual(lead["source_detail"], "storm_first")
        self.assertEqual(lead["damage_type"], "Accidental Discharge")

    @patch(
        "pipeline.leads.fetch_parcels_by_zip",
        return_value=[
            {
                "propertyAddress": "456 Opportunity Ave",
                "zip": "33133",
                "folioNumber": "01-0000-000-0002",
            }
        ],
    )
    def test_build_pre_permit_leads_uses_canonical_shape(self, _mock_fetch) -> None:
        storm_leads = [
            canonicalize_lead(
                {
                    "address": "789 Storm Rd",
                    "city": "Miami",
                    "zip": "33133",
                    "folio_number": "01-0000-000-0001",
                    "damage_type": "Hurricane/Wind",
                    "permit_type": "Storm Report",
                    "permit_date": "2025-09-28",
                    "storm_event": "Hurricane Test",
                    "source": "storm",
                    "county": "miami-dade",
                    "fema_declaration_number": "DR-9999",
                    "fema_incident_type": "Hurricane",
                }
            )
        ]

        pre_permit = build_pre_permit_leads(storm_leads=storm_leads, permit_leads=[])

        self.assertEqual(len(pre_permit), 1)
        lead = pre_permit[0]
        self.assertEqual(lead["source"], "storm")
        self.assertEqual(lead["source_detail"], "storm_first")
        self.assertEqual(lead["permit_type"], "Pre-Permit Storm Opportunity")
        self.assertIn("permit_date", lead)
        self.assertIn("folio_number", lead)
        self.assertNotIn("permitDate", lead)
        self.assertNotIn("folioNumber", lead)

    def test_deduplicate_prefers_permit_over_storm_first_for_same_folio(self) -> None:
        permit = canonicalize_lead(
            {
                "address": "123 Shared Foliage Ln",
                "city": "Miami",
                "zip": "33101",
                "folio_number": "01-1111-111-1111",
                "damage_type": "Roof",
                "permit_type": "Roof Repair",
                "permit_date": "2025-10-02",
                "source": "permit",
            }
        )
        storm_first = canonicalize_lead(
            {
                "address": "123 Shared Foliage Ln",
                "city": "Miami",
                "zip": "33101",
                "folio_number": "01-1111-111-1111",
                "damage_type": "Hurricane/Wind",
                "permit_type": "Pre-Permit Storm Opportunity",
                "permit_date": "2025-09-28",
                "source": "storm",
                "source_detail": "storm_first",
            }
        )

        deduped = deduplicate_canonical_leads([permit, storm_first])

        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0]["source_detail"], "permit")

    def test_merge_existing_state_preserves_real_outreach_and_tracking(self) -> None:
        fresh_lead = canonicalize_lead(
            {
                "address": "900 Tracking Blvd",
                "city": "Miami",
                "zip": "33135",
                "permit_date": "2025-10-04",
                "source": "permit",
                "outreach_message": "",
            }
        )
        existing = canonicalize_lead(
            {
                "id": "lead-123",
                "address": "900 Tracking Blvd",
                "city": "Miami",
                "zip": "33135",
                "permit_date": "2025-10-04",
                "source": "permit",
                "status": "Contacted",
                "notes": "Left voicemail",
                "outreach_message": "Real outreach copy",
                "enriched_at": "2025-10-05T12:00:00Z",
            }
        )

        merged = merge_existing_state(
            [fresh_lead], {fresh_lead["dedup_hash"]: existing}
        )[0]

        self.assertEqual(merged["id"], "lead-123")
        self.assertEqual(merged["status"], "Contacted")
        self.assertEqual(merged["notes"], "Left voicemail")
        self.assertEqual(merged["outreach_message"], "Real outreach copy")
        self.assertEqual(merged["enriched_at"], "2025-10-05T12:00:00Z")

    def test_outreach_batch_stamps_template_prefix_and_preserves_real_copy(
        self,
    ) -> None:
        templated, preserved = generate_outreach_batch(
            [
                canonicalize_lead(
                    {
                        "address": "1 Placeholder Way",
                        "city": "Miami",
                        "zip": "33101",
                        "permit_date": "2025-10-01",
                        "damage_type": "Roof",
                    }
                ),
                canonicalize_lead(
                    {
                        "address": "2 Real Copy Rd",
                        "city": "Miami",
                        "zip": "33102",
                        "permit_date": "2025-10-02",
                        "damage_type": "Roof",
                        "outreach_message": "Already personalized",
                    }
                ),
            ]
        )

        self.assertTrue(needs_outreach_enrichment(""))
        self.assertTrue(needs_outreach_enrichment("TEMPLATE: hello"))
        self.assertFalse(needs_outreach_enrichment("Already personalized"))
        self.assertTrue(templated["outreach_message"].startswith("TEMPLATE:"))
        self.assertEqual(preserved["outreach_message"], "Already personalized")


if __name__ == "__main__":
    unittest.main()
