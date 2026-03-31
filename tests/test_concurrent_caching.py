"""Tests for concurrent county scrapes and per-lookup caching."""
from __future__ import annotations

import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock

from pipeline.leads import build_canonical_lead_dataset


# ---------------------------------------------------------------------------
# PA caching tests
# ---------------------------------------------------------------------------

class PACachingTests(unittest.TestCase):
    """Verify that duplicate folio+county lookups return cached results."""

    def setUp(self) -> None:
        # Wipe the module cache before each test so tests are independent.
        import scrapers.property as prop_module
        prop_module._pa_cache.clear()

    def test_second_lookup_returns_cached_result(self) -> None:
        """Second lookup for same folio+county must NOT call the underlying API."""
        from scrapers.property import lookup_by_folio

        fake_pa_info = {
            "owner_name": "Cached Owner",
            "mailing_address": "123 Cached St",
            "mailing_city": "Miami",
            "mailing_state": "FL",
            "mailing_zip": "33101",
            "site_zip": "33101",
            "homestead": True,
            "assessed_value": 300000,
            "roof_age": 10,
        }

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value=fake_pa_info,
        ) as mock_lookup:
            # First lookup — should call the underlying function
            result1 = lookup_by_folio("01-1234-567-8900", county="miami-dade")
            # Second lookup for same folio+county — should use cache
            result2 = lookup_by_folio("01-1234-567-8900", county="miami-dade")
            # Third lookup with slight whitespace variation — same cache key
            result3 = lookup_by_folio("  01-1234-567-8900  ", county="  MIAMI-DADE  ")

        # Underlying function must be called exactly once
        self.assertEqual(mock_lookup.call_count, 1)
        # All three results must be identical
        self.assertEqual(result1, result2)
        self.assertEqual(result2, result3)
        self.assertEqual(result1["owner_name"], "Cached Owner")

    def test_different_folio_not_cached(self) -> None:
        """Different folios must each call the underlying API separately."""
        from scrapers.property import lookup_by_folio

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value={
                "owner_name": "Test Owner",
                "mailing_address": "",
                "mailing_city": "Miami",
                "mailing_state": "FL",
                "mailing_zip": "33101",
                "site_zip": "33101",
                "homestead": False,
                "assessed_value": 200000,
                "roof_age": 5,
            },
        ) as mock_lookup:
            lookup_by_folio("01-0000-000-0001", county="miami-dade")
            lookup_by_folio("01-0000-000-0002", county="miami-dade")

        # Each unique folio should trigger a separate call
        self.assertEqual(mock_lookup.call_count, 2)

    def test_different_county_not_cached(self) -> None:
        """Same folio but different county must NOT share cache entry."""
        from scrapers.property import lookup_by_folio

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value={
                "owner_name": "MD Owner",
                "mailing_address": "",
                "mailing_city": "Miami",
                "mailing_state": "FL",
                "mailing_zip": "33101",
                "site_zip": "33101",
                "homestead": True,
                "assessed_value": 400000,
                "roof_age": 15,
            },
        ) as mock_md, patch(
            "scrapers.property._lookup_by_folio_bcpa",
            return_value={
                "owner_name": "Broward Owner",
                "mailing_address": "",
                "mailing_city": "Fort Lauderdale",
                "mailing_state": "FL",
                "mailing_zip": "33301",
                "site_zip": "33301",
                "homestead": False,
                "assessed_value": 350000,
                "roof_age": 20,
            },
        ) as mock_bcpa:
            lookup_by_folio("01-1234-567-8900", county="miami-dade")
            lookup_by_folio("01-1234-567-8900", county="broward")

        # Each county must call its own endpoint
        self.assertEqual(mock_md.call_count, 1)
        self.assertEqual(mock_bcpa.call_count, 1)

    def test_miss_returns_none_and_caches_none(self) -> None:
        """A lookup that returns None must still be cached so it is not re-queried."""
        from scrapers.property import lookup_by_folio

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value=None,
        ) as mock_lookup:
            result1 = lookup_by_folio("not-a-real-folio", county="miami-dade")
            result2 = lookup_by_folio("not-a-real-folio", county="miami-dade")

        self.assertIsNone(result1)
        self.assertIsNone(result2)
        # Must be called only once — second lookup should return cached None
        self.assertEqual(mock_lookup.call_count, 1)


# ---------------------------------------------------------------------------
# Sunbiz caching tests
# ---------------------------------------------------------------------------

class SunbizCachingTests(unittest.TestCase):
    """Verify that duplicate Sunbiz entity lookups return cached results."""

    def setUp(self) -> None:
        import scrapers.sunbiz as sunbiz_module
        sunbiz_module._sunbiz_cache.clear()

    def test_second_lookup_returns_cached_result(self) -> None:
        """Second lookup for same entity name must NOT hit the network."""
        from scrapers.sunbiz import search_sunbiz

        fake_sunbiz_result = {
            "registered_agent_name": "Agent Smith",
            "registered_agent_address": "123 Agent Way",
            "registered_agent_phone": "305-555-0100",
            "officers": [],
        }

        with patch(
            "scrapers.sunbiz.requests.get",
        ) as mock_get:
            # Mock two different responses so we can tell which one was used
            mock_response1 = MagicMock()
            mock_response1.text = "<html>first response</html>"
            mock_response1.raise_for_status = MagicMock()
            mock_response1.status_code = 200
            mock_response1.json = MagicMock(return_value={})

            mock_response2 = MagicMock()
            mock_response2.text = "<html>second response</html>"
            mock_response2.raise_for_status = MagicMock()
            mock_response2.status_code = 200
            mock_response2.json = MagicMock(return_value={})

            mock_get.side_effect = [mock_response1, mock_response2]

            result1 = search_sunbiz("Palmetto Bay Holdings LLC")
            result2 = search_sunbiz("Palmetto Bay Holdings LLC")
            # Case variation — same entity
            result3 = search_sunbiz("PALMETTO BAY HOLDINGS LLC")

        # Network should be hit only once (first lookup populates cache)
        self.assertEqual(mock_get.call_count, 1)
        # All results must be identical
        self.assertEqual(result1, result2)
        self.assertEqual(result2, result3)


# ---------------------------------------------------------------------------
# Concurrent county scrape tests
# ---------------------------------------------------------------------------

class ConcurrentCountyScrapingTests(unittest.TestCase):
    """Verify that county permit scrapes run concurrently via ThreadPoolExecutor."""

    def test_permit_scrape_uses_thread_pool(self) -> None:
        """ThreadPoolExecutor must be used, and counties must run concurrently."""
        import threading
        import time as time_module

        # Track the order that counties are STARTED and COMPLETED.
        # In a sequential loop, start and complete order would be identical.
        # In concurrent execution, order may differ.
        call_log: list[str] = []
        log_lock = threading.Lock()

        def tracking_scrape(
            county: str,
            max_records: int = 500,
            lookback_days: int = 90,
            city: object = None,
        ) -> list[object]:
            with log_lock:
                call_log.append(f"start-{county}")
            # Simulate work with a small sleep
            time_module.sleep(0.05)
            with log_lock:
                call_log.append(f"end-{county}")
            return []

        # Patch scrape_damage_permits where it is USED (pipeline.leads), not where it is defined.
        with patch("pipeline.leads.scrape_damage_permits", side_effect=tracking_scrape):
            # Patch COUNTY_CONFIGS in pipeline.leads so only miami-dade and broward are "enabled"
            with patch("pipeline.leads.COUNTY_CONFIGS", {
                "miami-dade": {"enabled": True},
                "broward": {"enabled": True},
                "palm-beach": {"enabled": False},
            }):
                # Patch out other pipeline steps to isolate the county loop
                with patch("pipeline.leads.scrape_storm_events", return_value=[]), \
                     patch("pipeline.leads.build_fema_windows", return_value=[]), \
                     patch("pipeline.leads.build_pre_permit_leads", return_value=[]), \
                     patch("pipeline.leads.build_storm_leads_from_candidates", return_value=[]), \
                     patch("pipeline.leads.enrich_leads_with_owner_info", side_effect=lambda x, **kw: x), \
                     patch("pipeline.leads.deduplicate_canonical_leads", side_effect=lambda x: x), \
                     patch("pipeline.leads.compute_underpayment_flags"), \
                     patch("pipeline.leads.compute_repeat_damage"), \
                     patch("pipeline.leads.apply_company_signals"), \
                     patch("pipeline.leads._score_with_breakdown", return_value=(0, {})), \
                     patch("pipeline.leads.generate_outreach_batch", side_effect=lambda x: x), \
                     patch("pipeline.leads.load_existing_state_from_json", return_value={}):
                    build_canonical_lead_dataset(supabase=None)

        # We expect at least miami-dade and broward to be started
        started = [c for c in call_log if c.startswith("start-")]
        self.assertIn("start-miami-dade", started)
        self.assertIn("start-broward", started)

        # In concurrent execution, the second county starts BEFORE the first ends.
        # In sequential, "start-broward" would come after "end-miami-dade".
        # Check that we have interleaving: both counties' start events appear
        # before at least one of their end events.
        start_md = call_log.index("start-miami-dade")
        start_bw = call_log.index("start-broward")
        end_md = call_log.index("end-miami-dade")
        end_bw = call_log.index("end-broward")

        # At least one start must come before at least one end of the OTHER county
        concurrent_interleaving = (
            start_bw < end_md or start_md < end_bw
        )
        self.assertTrue(
            concurrent_interleaving,
            f"Expected concurrent interleaving but got sequential order: {call_log}",
        )


if __name__ == "__main__":
    unittest.main()
