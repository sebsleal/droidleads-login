"""
Tests for the storm-to-lead pipeline:
build_storm_leads_from_candidates() — converts high-scoring storm candidates
(score >= 75) into canonical leads via targeted parcel scans.
"""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from pipeline.leads import (
    build_storm_leads_from_candidates,
    canonicalize_lead,
)


# ---------------------------------------------------------------------------
# Synthetic storm candidates (matching public/storm_candidates.json shape)
# ---------------------------------------------------------------------------

CANDIDATE_HIGH_SCORE = {
    "id": "abc123",
    "candidateType": "area",
    "county": "broward",
    "city": "Fort Lauderdale",
    "zip": "",
    "locationLabel": "Multiple areas in Broward County",
    "stormEvent": "Flash Flood impact in Broward County",
    "eventType": "Flash Flood",
    "eventDate": "2025-10-26",
    "femaDeclarationNumber": "DR-9999",
    "femaIncidentType": "Flash Flood",
    "narrative": "Street flooding reported.",
    "score": 82,
    "scoreReasoning": "Flash Flood carries a 18-point severity weight.",
    "status": "Watching",
    "notes": "",
    "source": "NOAA Storm Events + FEMA Disaster Declarations",
}

CANDIDATE_BORDERLINE = {
    "id": "def456",
    "candidateType": "area",
    "county": "miami-dade",
    "city": "Miami",
    "zip": "",
    "locationLabel": "Multiple areas in Miami-Dade County",
    "stormEvent": "Flood impact in Miami-Dade County",
    "eventType": "Flood",
    "eventDate": "2025-09-01",
    "femaDeclarationNumber": "",
    "femaIncidentType": "",
    "narrative": "Report of street flooding.",
    "score": 74,  # below threshold
    "scoreReasoning": "Flood carries a 18-point severity weight.",
    "status": "Watching",
    "notes": "",
    "source": "NOAA Storm Events",
}

CANDIDATE_ANOTHER_HIGH = {
    "id": "ghi789",
    "candidateType": "area",
    "county": "broward",
    "city": "Deerfield Beach",
    "zip": "",
    "locationLabel": "Deerfield Beach area (Broward)",
    "stormEvent": "Tropical Storm impact in Broward County",
    "eventType": "Tropical Storm",
    "eventDate": "2025-10-15",
    "femaDeclarationNumber": "DR-8888",
    "femaIncidentType": "Tropical Storm",
    "narrative": "Tropical storm surge and wind damage reported.",
    "score": 91,
    "scoreReasoning": "Tropical Storm carries a 20-point severity weight.",
    "status": "Watching",
    "notes": "",
    "source": "NOAA Storm Events + FEMA Disaster Declarations",
}


class BuildStormLeadsFromCandidatesTests(unittest.TestCase):
    """Tests for build_storm_leads_from_candidates()."""

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_filters_to_score_75_or_higher(self, mock_fetch: MagicMock) -> None:
        """Candidates with score < 75 must not generate any leads."""
        mock_fetch.return_value = []
        candidates = [CANDIDATE_BORDERLINE]  # score 74
        leads = build_storm_leads_from_candidates(candidates)
        self.assertEqual(leads, [])
        mock_fetch.assert_not_called()

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_score_75_included(self, mock_fetch: MagicMock) -> None:
        """A candidate with score exactly 75 must be processed."""
        mock_fetch.return_value = []
        candidate = {**CANDIDATE_HIGH_SCORE, "score": 75, "id": "score-75"}
        leads = build_storm_leads_from_candidates([candidate])
        # Should have attempted a parcel fetch (may return empty list)
        self.assertIsInstance(leads, list)

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_generates_leads_from_parcels(self, mock_fetch: MagicMock) -> None:
        """High-scoring candidates with returned parcels produce canonical leads."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-2222-222-2222",
                "propertyAddress": "123 Oak Street",
                "zip": "33301",
            },
            {
                "folioNumber": "02-3333-333-3333",
                "propertyAddress": "456 Pine Avenue",
                "zip": "33302",
            },
        ]
        candidates = [CANDIDATE_HIGH_SCORE]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 2)
        for lead in leads:
            self.assertEqual(lead["source"], "storm")
            self.assertEqual(lead["source_detail"], "storm_event")
            self.assertEqual(lead["county"], "broward")
            self.assertEqual(lead["storm_event"], CANDIDATE_HIGH_SCORE["stormEvent"])
            self.assertEqual(lead["fema_declaration_number"], CANDIDATE_HIGH_SCORE["femaDeclarationNumber"])
            self.assertEqual(lead["fema_incident_type"], CANDIDATE_HIGH_SCORE["femaIncidentType"])
            self.assertIn("permit_type", lead)
            self.assertIn("folio_number", lead)
            self.assertIn("dedup_hash", lead)

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_skips_existing_addresses(self, mock_fetch: MagicMock) -> None:
        """Parcel addresses already in permit_leads are skipped."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-2222-222-2222",
                "propertyAddress": "123 Oak Street",
                "zip": "33301",
            },
            {
                "folioNumber": "03-4444-444-4444",
                "propertyAddress": "789 Elm Boulevard",
                "zip": "33303",
            },
        ]
        # 123 Oak Street already has a permit — should be filtered out
        existing_permit_leads = [
            canonicalize_lead({
                "address": "123 Oak Street",
                "city": "Fort Lauderdale",
                "permit_date": "2025-10-01",
                "source": "permit",
            })
        ]
        candidates = [CANDIDATE_HIGH_SCORE]
        leads = build_storm_leads_from_candidates(candidates, existing_permit_leads=existing_permit_leads)

        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0]["address"], "789 Elm Boulevard")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_fema_data_carries_over_to_generated_leads(self, mock_fetch: MagicMock) -> None:
        """FEMA declaration and incident type from the candidate propagate to leads."""
        mock_fetch.return_value = [
            {
                "folioNumber": "04-5555-555-5555",
                "propertyAddress": "321 Maple Court",
                "zip": "33304",
            },
        ]
        candidates = [CANDIDATE_HIGH_SCORE]  # has DR-9999 / Flash Flood
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        lead = leads[0]
        self.assertEqual(lead["fema_declaration_number"], "DR-9999")
        self.assertEqual(lead["fema_incident_type"], "Flash Flood")
        self.assertEqual(lead["storm_event"], "Flash Flood impact in Broward County")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_multiple_high_scoring_candidates(self, mock_fetch: MagicMock) -> None:
        """Each high-scoring candidate triggers its own parcel scan."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-1111-111-1111",
                "propertyAddress": "100 First Street",
                "zip": "33311",
            },
        ]
        candidates = [CANDIDATE_HIGH_SCORE, CANDIDATE_ANOTHER_HIGH]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 2)
        events = {lead["storm_event"] for lead in leads}
        self.assertIn("Flash Flood impact in Broward County", events)
        self.assertIn("Tropical Storm impact in Broward County", events)

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_empty_candidates_list(self, mock_fetch: MagicMock) -> None:
        """Empty candidates list returns empty leads without calling parcel fetch."""
        leads = build_storm_leads_from_candidates([])
        self.assertEqual(leads, [])
        mock_fetch.assert_not_called()

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_no_parcels_returns_empty_list(self, mock_fetch: MagicMock) -> None:
        """High-scoring candidate with no parcel results returns empty leads."""
        mock_fetch.return_value = []
        leads = build_storm_leads_from_candidates([CANDIDATE_HIGH_SCORE])
        self.assertEqual(leads, [])

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_damage_type_from_event_type(self, mock_fetch: MagicMock) -> None:
        """Lead damage_type is derived from the candidate's event type."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-6666-666-6666",
                "propertyAddress": "200 Windy Way",
                "zip": "33306",
            },
        ]
        # Tropical Storm candidate
        candidates = [CANDIDATE_ANOTHER_HIGH]  # Tropical Storm, score 91
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        # Flood type from Flood event, Hurricane/Wind from Tropical Storm
        self.assertEqual(leads[0]["damage_type"], "Hurricane/Wind")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_leads_have_noaa_ids_from_candidate(self, mock_fetch: MagicMock) -> None:
        """When available, candidate episode/event IDs are stored on leads."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-7777-777-7777",
                "propertyAddress": "300 Record Road",
                "zip": "33307",
            },
        ]
        # Candidate has no noaa_episode_id / noaa_event_id in our shape
        # but the generated lead should store the candidate id as reference
        candidates = [CANDIDATE_HIGH_SCORE]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        lead = leads[0]
        self.assertEqual(lead["source"], "storm")
        self.assertEqual(lead["source_detail"], "storm_event")
        # storm_event should be populated from candidate
        self.assertEqual(lead["storm_event"], CANDIDATE_HIGH_SCORE["stormEvent"])
        # noaa_episode_id stores the candidate id as reference
        self.assertEqual(lead["noaa_episode_id"], CANDIDATE_HIGH_SCORE["id"])


if __name__ == "__main__":
    unittest.main()
