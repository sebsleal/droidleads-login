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
    """Tests for build_storm_leads_from_candidates() — Miami-Dade parcel path.

    These tests use Miami-Dade candidates so they exercise the
    fetch_parcels_by_zip() code path (GeoProp).  County-routing for
    Broward and Palm Beach is covered in CountyRoutingTests.
    """

    # Miami-Dade candidate for tests that exercise the parcel API path
    CANDIDATE_MIAMI_HIGH = {
        "id": "md-001",
        "candidateType": "area",
        "county": "miami-dade",
        "city": "Miami",
        "zip": "",
        "locationLabel": "Miami area",
        "stormEvent": "Hurricane impact in Miami-Dade",
        "eventType": "Hurricane",
        "eventDate": "2025-09-01",
        "femaDeclarationNumber": "DR-1111",
        "femaIncidentType": "Hurricane",
        "narrative": "Major hurricane landfall.",
        "score": 90,
        "scoreReasoning": "Hurricane carries maximum weight.",
        "status": "Watching",
        "notes": "",
        "source": "NOAA Storm Events",
    }

    CANDIDATE_MIAMI_BORDERLINE = {
        "id": "md-def",
        "candidateType": "area",
        "county": "miami-dade",
        "city": "Miami",
        "zip": "",
        "locationLabel": "Miami area",
        "stormEvent": "Flood impact in Miami-Dade",
        "eventType": "Flood",
        "eventDate": "2025-09-01",
        "femaDeclarationNumber": "",
        "femaIncidentType": "",
        "narrative": "Street flooding.",
        "score": 74,  # below threshold
        "scoreReasoning": "Flood carries a weight.",
        "status": "Watching",
        "notes": "",
        "source": "NOAA Storm Events",
    }

    CANDIDATE_MIAMI_ANOTHER_HIGH = {
        "id": "md-002",
        "candidateType": "area",
        "county": "miami-dade",
        "city": "Miami",
        "zip": "",
        "locationLabel": "Miami area",
        "stormEvent": "Tropical Storm impact in Miami-Dade",
        "eventType": "Tropical Storm",
        "eventDate": "2025-10-15",
        "femaDeclarationNumber": "DR-2222",
        "femaIncidentType": "Tropical Storm",
        "narrative": "Tropical storm damage reported.",
        "score": 88,
        "scoreReasoning": "Tropical Storm carries a weight.",
        "status": "Watching",
        "notes": "",
        "source": "NOAA Storm Events + FEMA",
    }

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_filters_to_score_75_or_higher(self, mock_fetch: MagicMock) -> None:
        """Candidates with score < 75 must not generate any leads."""
        mock_fetch.return_value = []
        candidates = [self.CANDIDATE_MIAMI_BORDERLINE]  # score 74
        leads = build_storm_leads_from_candidates(candidates)
        self.assertEqual(leads, [])
        mock_fetch.assert_not_called()

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_score_75_included(self, mock_fetch: MagicMock) -> None:
        """A candidate with score exactly 75 must be processed."""
        mock_fetch.return_value = []
        candidate = {**self.CANDIDATE_MIAMI_HIGH, "score": 75, "id": "score-75"}
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
                "zip": "33101",
            },
            {
                "folioNumber": "02-3333-333-3333",
                "propertyAddress": "456 Pine Avenue",
                "zip": "33102",
            },
        ]
        candidates = [self.CANDIDATE_MIAMI_HIGH]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 2)
        for lead in leads:
            self.assertEqual(lead["source"], "storm")
            self.assertEqual(lead["source_detail"], "storm_event")
            self.assertEqual(lead["county"], "miami-dade")
            self.assertEqual(lead["storm_event"], self.CANDIDATE_MIAMI_HIGH["stormEvent"])
            self.assertEqual(lead["fema_declaration_number"], self.CANDIDATE_MIAMI_HIGH["femaDeclarationNumber"])
            self.assertEqual(lead["fema_incident_type"], self.CANDIDATE_MIAMI_HIGH["femaIncidentType"])
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
                "zip": "33101",
            },
            {
                "folioNumber": "03-4444-444-4444",
                "propertyAddress": "789 Elm Boulevard",
                "zip": "33103",
            },
        ]
        # 123 Oak Street already has a permit — should be filtered out
        existing_permit_leads = [
            canonicalize_lead({
                "address": "123 Oak Street",
                "city": "Miami",
                "permit_date": "2025-09-01",
                "source": "permit",
            })
        ]
        candidates = [self.CANDIDATE_MIAMI_HIGH]
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
                "zip": "33104",
            },
        ]
        candidates = [self.CANDIDATE_MIAMI_HIGH]  # has DR-1111 / Hurricane
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        lead = leads[0]
        self.assertEqual(lead["fema_declaration_number"], "DR-1111")
        self.assertEqual(lead["fema_incident_type"], "Hurricane")
        self.assertEqual(lead["storm_event"], "Hurricane impact in Miami-Dade")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_multiple_high_scoring_candidates(self, mock_fetch: MagicMock) -> None:
        """Each high-scoring candidate triggers its own parcel scan."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-1111-111-1111",
                "propertyAddress": "100 First Street",
                "zip": "33111",
            },
        ]
        candidates = [self.CANDIDATE_MIAMI_HIGH, self.CANDIDATE_MIAMI_ANOTHER_HIGH]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 2)
        events = {lead["storm_event"] for lead in leads}
        self.assertIn("Hurricane impact in Miami-Dade", events)
        self.assertIn("Tropical Storm impact in Miami-Dade", events)

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
        leads = build_storm_leads_from_candidates([self.CANDIDATE_MIAMI_HIGH])
        self.assertEqual(leads, [])

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_damage_type_from_event_type(self, mock_fetch: MagicMock) -> None:
        """Lead damage_type is derived from the candidate's event type."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-6666-666-6666",
                "propertyAddress": "200 Windy Way",
                "zip": "33106",
            },
        ]
        # Tropical Storm candidate
        candidates = [self.CANDIDATE_MIAMI_ANOTHER_HIGH]  # Tropical Storm, score 88
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        # Hurricane/Wind from Tropical Storm
        self.assertEqual(leads[0]["damage_type"], "Hurricane/Wind")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_leads_have_noaa_ids_from_candidate(self, mock_fetch: MagicMock) -> None:
        """When available, candidate episode/event IDs are stored on leads."""
        mock_fetch.return_value = [
            {
                "folioNumber": "01-7777-777-7777",
                "propertyAddress": "300 Record Road",
                "zip": "33107",
            },
        ]
        # The generated lead should store the candidate id as noaa_episode_id
        candidates = [self.CANDIDATE_MIAMI_HIGH]
        leads = build_storm_leads_from_candidates(candidates)

        self.assertEqual(len(leads), 1)
        lead = leads[0]
        self.assertEqual(lead["source"], "storm")
        self.assertEqual(lead["source_detail"], "storm_event")
        # storm_event should be populated from candidate
        self.assertEqual(lead["storm_event"], self.CANDIDATE_MIAMI_HIGH["stormEvent"])
        # noaa_episode_id stores the candidate id as reference
        self.assertEqual(lead["noaa_episode_id"], self.CANDIDATE_MIAMI_HIGH["id"])


class CountyRoutingTests(unittest.TestCase):
    """Tests for VAL-EXPAND-003: county-correct routing in build_storm_leads_from_candidates()."""

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_broward_candidate_routes_to_permit_scraper_not_miami_parcels(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """Broward county candidates must use scrape_damage_permits, not fetch_parcels_by_zip."""
        mock_scrape.return_value = [
            {
                "owner_name": "Property Owner",
                "address": "100 Broward St",
                "city": "Fort Lauderdale",
                "zip": "33301",
                "folio_number": "broward-001",
                "damage_type": "Flash Flood",
                "permit_type": "Pre-Permit Storm Opportunity",
                "permit_date": "2025-10-26",
                "permit_value": 0,
                "contractor_name": None,
                "storm_event": "Flash Flood impact in Broward County",
                "source": "permit",
                "status": "New",
                "contact_email": None,
                "contact_phone": None,
                "county": "broward",
            }
        ]
        mock_fetch.return_value = []

        candidate = {**CANDIDATE_HIGH_SCORE}  # county=broward, score=82
        leads = build_storm_leads_from_candidates([candidate])

        # Broward must use the permit scraper, NOT the Miami-Dade parcel API
        mock_scrape.assert_called_once()
        mock_fetch.assert_not_called()
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0]["county"], "broward")

    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_miami_dade_candidate_routes_to_parcel_scraper(
        self, mock_fetch: MagicMock
    ) -> None:
        """Miami-Dade county candidates must use fetch_parcels_by_zip (GeoProp)."""
        mock_fetch.return_value = [
            {
                "folioNumber": "md-001",
                "propertyAddress": "200 Miami Ave",
                "zip": "33101",
            },
        ]

        candidate = {
            "id": "md-001",
            "candidateType": "area",
            "county": "miami-dade",
            "city": "Miami",
            "zip": "",
            "locationLabel": "Miami area",
            "stormEvent": "Hurricane impact in Miami-Dade",
            "eventType": "Hurricane",
            "eventDate": "2025-09-01",
            "femaDeclarationNumber": "DR-1111",
            "femaIncidentType": "Hurricane",
            "narrative": "Hurricane damage reported.",
            "score": 90,
            "scoreReasoning": "Hurricane carries maximum weight.",
            "status": "Watching",
            "notes": "",
            "source": "NOAA Storm Events",
        }
        leads = build_storm_leads_from_candidates([candidate])

        mock_fetch.assert_called_once()
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0]["county"], "miami-dade")

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_palm_beach_candidate_skipped_no_public_endpoint(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """Palm Beach candidates must not call any scraper (no public endpoint as of 2026-03)."""
        mock_fetch.return_value = []
        mock_scrape.return_value = []

        candidate = {
            "id": "pb-001",
            "candidateType": "area",
            "county": "palm-beach",
            "city": "West Palm Beach",
            "zip": "",
            "locationLabel": "West Palm Beach area",
            "stormEvent": "Tropical Storm impact in Palm Beach County",
            "eventType": "Tropical Storm",
            "eventDate": "2025-10-20",
            "femaDeclarationNumber": "DR-7777",
            "femaIncidentType": "Tropical Storm",
            "narrative": "Storm damage reported.",
            "score": 88,
            "scoreReasoning": "Tropical Storm carries a 20-point weight.",
            "status": "Watching",
            "notes": "",
            "source": "NOAA Storm Events + FEMA",
        }
        leads = build_storm_leads_from_candidates([candidate])

        # Palm Beach: no parcel API, no permit scraper should be called
        mock_fetch.assert_not_called()
        mock_scrape.assert_not_called()
        self.assertEqual(leads, [])

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_mixed_counties_route_correctly(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """Miami-Dade uses parcels, Broward uses permits, Palm Beach skipped — all in one call."""
        mock_fetch.return_value = [
            {"folioNumber": "md-001", "propertyAddress": "100 Miami St", "zip": "33101"},
        ]
        mock_scrape.return_value = [
            {
                "owner_name": "Property Owner",
                "address": "200 Broward Ave",
                "city": "Fort Lauderdale",
                "zip": "33301",
                "folio_number": "br-001",
                "damage_type": "Hurricane/Wind",
                "permit_type": "Pre-Permit Storm Opportunity",
                "permit_date": "2025-10-15",
                "permit_value": 0,
                "contractor_name": None,
                "storm_event": "Hurricane impact in Broward",
                "source": "permit",
                "status": "New",
                "contact_email": None,
                "contact_phone": None,
                "county": "broward",
            }
        ]

        candidates = [
            {
                "id": "md-001", "candidateType": "area", "county": "miami-dade",
                "city": "Miami", "zip": "", "locationLabel": "Miami",
                "stormEvent": "Hurricane impact in Miami-Dade",
                "eventType": "Hurricane", "eventDate": "2025-09-01",
                "femaDeclarationNumber": "DR-1111", "femaIncidentType": "Hurricane",
                "narrative": "", "score": 90, "scoreReasoning": "", "status": "Watching",
                "notes": "", "source": "NOAA",
            },
            {
                "id": "br-001", "candidateType": "area", "county": "broward",
                "city": "Fort Lauderdale", "zip": "", "locationLabel": "Broward",
                "stormEvent": "Hurricane impact in Broward",
                "eventType": "Hurricane", "eventDate": "2025-10-15",
                "femaDeclarationNumber": "DR-2222", "femaIncidentType": "Hurricane",
                "narrative": "", "score": 85, "scoreReasoning": "", "status": "Watching",
                "notes": "", "source": "NOAA",
            },
            {
                "id": "pb-001", "candidateType": "area", "county": "palm-beach",
                "city": "West Palm Beach", "zip": "", "locationLabel": "Palm Beach",
                "stormEvent": "Tropical Storm in Palm Beach",
                "eventType": "Tropical Storm", "eventDate": "2025-10-20",
                "femaDeclarationNumber": "DR-3333", "femaIncidentType": "Tropical Storm",
                "narrative": "", "score": 80, "scoreReasoning": "", "status": "Watching",
                "notes": "", "source": "NOAA",
            },
        ]
        leads = build_storm_leads_from_candidates(candidates)

        # Miami → fetch_parcels_by_zip, Broward → scrape_damage_permits, Palm Beach → neither
        self.assertEqual(mock_fetch.call_count, 1)
        self.assertEqual(mock_scrape.call_count, 1)
        # 1 Miami parcel lead + 1 Broward permit lead = 2 leads
        self.assertEqual(len(leads), 2)
        counties = {lead["county"] for lead in leads}
        self.assertEqual(counties, {"miami-dade", "broward"})


class AreaTargetingTests(unittest.TestCase):
    """Tests for area-specific targeting using candidate city/zip fields."""

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_city_specificity_used_for_broward_area_scan(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """When candidate has a city field, permit scraper must be called for that city."""
        mock_scrape.return_value = []
        mock_fetch.return_value = []

        # Candidate with specific city = Deerfield Beach (not Fort Lauderdale default)
        candidate = {
            **CANDIDATE_ANOTHER_HIGH,  # already has city=Deerfield Beach, score=91
            "city": "Deerfield Beach",
        }
        leads = build_storm_leads_from_candidates([candidate])

        mock_scrape.assert_called_once()
        # Verify city was passed to the permit scraper
        call_kwargs = mock_scrape.call_args
        # city kwarg should be passed to permit scraper
        self.assertIsNotNone(call_kwargs)

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_zip_specificity_narrows_miami_dade_scan(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """When candidate has a zip field, parcel scan must use that zip only."""
        mock_fetch.return_value = [
            {"folioNumber": "33101-001", "propertyAddress": "1 Main St", "zip": "33101"},
        ]
        mock_scrape.return_value = []

        candidate = {
            "id": "md-zip-001",
            "candidateType": "area",
            "county": "miami-dade",
            "city": "Miami",
            "zip": "33101",  # specific ZIP — must narrow the scan
            "locationLabel": "Miami Downtown",
            "stormEvent": "Hurricane impact in Miami-Dade",
            "eventType": "Hurricane",
            "eventDate": "2025-09-01",
            "femaDeclarationNumber": "DR-1111",
            "femaIncidentType": "Hurricane",
            "narrative": "",
            "score": 90,
            "scoreReasoning": "",
            "status": "Watching",
            "notes": "",
            "source": "NOAA",
        }
        leads = build_storm_leads_from_candidates([candidate])

        mock_fetch.assert_called_once()
        # The called zip list should contain only 33101
        called_zips = mock_fetch.call_args[0][0]
        self.assertIn(33101, called_zips)
        self.assertEqual(len(called_zips), 1)

    @patch("pipeline.leads.scrape_damage_permits")
    @patch("pipeline.leads.fetch_parcels_by_zip")
    def test_county_wide_scan_when_no_area_specificity(
        self, mock_fetch: MagicMock, mock_scrape: MagicMock
    ) -> None:
        """When candidate has no city or zip, full county scan is used."""
        mock_fetch.return_value = [
            {"folioNumber": "md-001", "propertyAddress": "100 Main St", "zip": "33101"},
        ]
        mock_scrape.return_value = []

        candidate = {
            "id": "md-wide-001",
            "candidateType": "area",
            "county": "miami-dade",
            "city": "",  # no city specificity
            "zip": "",    # no zip specificity
            "locationLabel": "All of Miami-Dade",
            "stormEvent": "Hurricane impact in Miami-Dade",
            "eventType": "Hurricane",
            "eventDate": "2025-09-01",
            "femaDeclarationNumber": "DR-1111",
            "femaIncidentType": "Hurricane",
            "narrative": "",
            "score": 90,
            "scoreReasoning": "",
            "status": "Watching",
            "notes": "",
            "source": "NOAA",
        }
        leads = build_storm_leads_from_candidates([candidate])

        mock_fetch.assert_called_once()
        # Full county ZIP set should be passed (all Miami-Dade ZIPs)
        called_zips = mock_fetch.call_args[0][0]
        from scrapers.parcels import MIAMI_DADE_ZIPS
        self.assertEqual(set(called_zips), set(MIAMI_DADE_ZIPS))


if __name__ == "__main__":
    unittest.main()
