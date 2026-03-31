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
# Zero-enabled-counties guard
# ---------------------------------------------------------------------------

class ZeroEnabledCountiesGuardTests(unittest.TestCase):
    """Verify that zero enabled counties does not raise ValueError."""

    def test_zero_enabled_counties_does_not_raise(self) -> None:
        """Pipeline must not crash when all counties are disabled."""
        with patch("pipeline.leads.COUNTY_CONFIGS", {
            "miami-dade": {"enabled": False},
            "broward": {"enabled": False},
            "palm-beach": {"enabled": False},
        }):
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
                # Must not raise ValueError or any other exception
                result = build_canonical_lead_dataset(supabase=None)
                # Should return empty result gracefully
                self.assertEqual(result.permit_count, 0)
                self.assertEqual(result.leads, [])


# ---------------------------------------------------------------------------
# County normalization tests
# ---------------------------------------------------------------------------

class CountyNormalizationTests(unittest.TestCase):
    """Verify county normalization in lookup_by_folio."""

    def setUp(self) -> None:
        import scrapers.property as prop_module
        prop_module._pa_cache.clear()

    def test_whitespace_broward_routes_to_bcpa(self) -> None:
        """County with surrounding whitespace like ' BROWARD ' must route to BCPA, not Miami-Dade."""
        from scrapers.property import lookup_by_folio

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value={
                "owner_name": "MD Owner", "mailing_address": "", "mailing_city": "Miami",
                "mailing_state": "FL", "mailing_zip": "33101", "site_zip": "33101",
                "homestead": True, "assessed_value": 400000, "roof_age": 15,
            },
        ) as mock_md, patch(
            "scrapers.property._lookup_by_folio_bcpa",
            return_value={
                "owner_name": "Broward Owner", "mailing_address": "", "mailing_city": "Fort Lauderdale",
                "mailing_state": "FL", "mailing_zip": "33301", "site_zip": "33301",
                "homestead": False, "assessed_value": 350000, "roof_age": 20,
            },
        ) as mock_bcpa:
            lookup_by_folio("01-1234-567-8900", county=" BROWARD ")
            # Must call BCPA (broward), NOT Miami-Dade
            self.assertEqual(mock_bcpa.call_count, 1)
            self.assertEqual(mock_md.call_count, 0)

    def test_whitespace_county_uses_consistent_cache_key(self) -> None:
        """Whitespace variants of the same county must share the same cache entry."""
        from scrapers.property import lookup_by_folio

        with patch(
            "scrapers.property._lookup_by_folio_miami_dade",
            return_value={
                "owner_name": "Test", "mailing_address": "", "mailing_city": "Miami",
                "mailing_state": "FL", "mailing_zip": "33101", "site_zip": "33101",
                "homestead": True, "assessed_value": 400000, "roof_age": 15,
            },
        ) as mock_md:
            lookup_by_folio("01-0000-000-0001", county="  miami-dade  ")
            lookup_by_folio("01-0000-000-0001", county="miami-dade")
            lookup_by_folio("01-0000-000-0001", county="  MIAMI-DADE  ")
            # Single call — all three use the same normalized cache key
            self.assertEqual(mock_md.call_count, 1)


# ---------------------------------------------------------------------------
# Concurrent county scrape tests
# ---------------------------------------------------------------------------

class ConcurrentCountyScrapingTests(unittest.TestCase):
    """Verify that county permit scrapes run concurrently via ThreadPoolExecutor."""

    def test_permit_scrape_runs_in_parallel_proven_by_time(self) -> None:
        """
        Prove real parallel execution by measuring wall-clock time.

        With 3 counties each sleeping 0.15s:
        - Sequential execution would take ≥ 0.45s
        - True parallel execution takes ≈ 0.15s (all threads run simultaneously)

        A test that only checks interleaving could pass under sequential
        execution with a clever scheduler (thread_yield between start/end),
        so we use wall-clock timing as the contract-faithful proof.
        """
        import time as time_module

        SLEEP = 0.15   # seconds per county scrape
        COUNTY_COUNT = 3   # miami-dade, broward, palm-beach (all enabled in this test)

        def tracking_scrape(
            county: str,
            max_records: int = 500,
            lookback_days: int = 90,
            city: object = None,
        ) -> list[object]:
            time_module.sleep(SLEEP)
            return []

        with patch("pipeline.leads.scrape_damage_permits", side_effect=tracking_scrape):
            with patch("pipeline.leads.COUNTY_CONFIGS", {
                "miami-dade": {"enabled": True},
                "broward": {"enabled": True},
                "palm-beach": {"enabled": True},
            }):
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
                    start = time_module.perf_counter()
                    build_canonical_lead_dataset(supabase=None)
                    elapsed = time_module.perf_counter() - start

        # Sequential would be 3 * 0.15 = 0.45s minimum.
        # Parallel should be close to 0.15s (all threads run simultaneously).
        # Use 0.35s as the threshold — anything at or above sequential time
        # means the pipeline ran sequentially.
        self.assertLess(
            elapsed,
            SLEEP * COUNTY_COUNT * 0.78,
            f"Expected parallel execution (< {SLEEP * COUNTY_COUNT * 0.78:.2f}s) "
            f"but took {elapsed:.2f}s — pipeline appears to be running sequentially",
        )


if __name__ == "__main__":
    unittest.main()
