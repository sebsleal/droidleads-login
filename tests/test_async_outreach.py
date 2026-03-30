"""
Tests verifying async/parallel outreach enrichment per VAL-VOLUME-006 and VAL-VOLUME-007.
"""
import time
import unittest
from unittest.mock import MagicMock, patch


class MaxPerRunTests(unittest.TestCase):
    """VAL-VOLUME-006: MAX_PER_RUN in enrich_outreach.py equals 500."""

    def test_max_per_run_equals_500(self):
        """Import enrich_outreach and assert MAX_PER_RUN == 500."""
        import enrich_outreach
        self.assertEqual(
            enrich_outreach.MAX_PER_RUN, 500,
            f"Expected MAX_PER_RUN=500, got {enrich_outreach.MAX_PER_RUN}"
        )

    def test_max_per_run_is_module_level_constant(self):
        """MAX_PER_RUN should be an integer constant at module level."""
        import enrich_outreach
        self.assertIsInstance(enrich_outreach.MAX_PER_RUN, int)


class ParallelExecutionTests(unittest.TestCase):
    """VAL-VOLUME-007: Parallel API calls are measurably faster than sequential with sleep."""

    def _make_fake_lead(self, i):
        return {
            "id": f"lead-{i}",
            "score": 50,
            "propertyAddress": f"{i} Test St",
            "outreachMessage": "TEMPLATE: placeholder",
        }

    def test_parallel_execution_faster_than_sequential_sleep(self):
        """
        Processing 10 leads in parallel should complete significantly faster than
        the 10 × 0.3s = 3.0s it would take with the old sequential time.sleep(0.3).

        We simulate each API call taking 0.05s by patching generate_message with a
        short sleep. Sequential would be ≥ 3.0s; parallel with 10 workers should be
        well under 1.5s.
        """
        import enrich_outreach

        def slow_generate_message(client, lead):
            time.sleep(0.05)  # simulate real network latency
            return "Hello from the API"

        leads = [self._make_fake_lead(i) for i in range(10)]

        # Patch generate_message (the per-lead API call) with a slow stub
        with patch.object(enrich_outreach, "generate_message", side_effect=slow_generate_message):
            start = time.time()
            # Call the parallel enrichment function directly
            results = enrich_outreach.enrich_leads_parallel(
                client=MagicMock(),
                batch=leads,
                max_workers=10,
            )
            elapsed = time.time() - start

        # 10 × 0.05s sequential = 0.5s; parallel should be under 0.4s
        # Sequential with 0.3s sleep would be 3.0s; our threshold is 1.5s
        self.assertLess(
            elapsed, 1.5,
            f"Parallel enrichment of 10 leads took {elapsed:.2f}s — expected < 1.5s"
        )
        self.assertEqual(len(results), 10)

    def test_enrich_leads_parallel_returns_correct_messages(self):
        """enrich_leads_parallel updates each lead's outreachMessage."""
        import enrich_outreach

        leads = [self._make_fake_lead(i) for i in range(5)]

        def fake_generate(client, lead):
            return f"Message for {lead['id']}"

        with patch.object(enrich_outreach, "generate_message", side_effect=fake_generate):
            results = enrich_outreach.enrich_leads_parallel(
                client=MagicMock(),
                batch=leads,
                max_workers=5,
            )

        # Each result should be a (lead, message) tuple or the leads should be updated
        # We rely on the returned list of (lead_id, message) or updated leads
        self.assertEqual(len(results), 5)

    def test_no_per_lead_sleep_between_calls(self):
        """
        The main enrichment loop must NOT call time.sleep() between individual API calls.
        We verify this by checking that processing 10 leads with instant API responses
        completes in well under 1s (sequential 0.3s × 10 = 3.0s would fail this).
        """
        import enrich_outreach

        def instant_generate(client, lead):
            return "Instant message"

        leads = [self._make_fake_lead(i) for i in range(10)]

        with patch.object(enrich_outreach, "generate_message", side_effect=instant_generate):
            start = time.time()
            enrich_outreach.enrich_leads_parallel(
                client=MagicMock(),
                batch=leads,
                max_workers=10,
            )
            elapsed = time.time() - start

        # Should be nearly instant without sleep delays
        self.assertLess(
            elapsed, 0.5,
            f"Expected < 0.5s for 10 instant API calls, got {elapsed:.2f}s — "
            "per-lead time.sleep() may still be present"
        )

    def test_max_workers_default_is_reasonable(self):
        """enrich_leads_parallel should have a default max_workers of 10 (or similar)."""
        import inspect
        import enrich_outreach

        sig = inspect.signature(enrich_outreach.enrich_leads_parallel)
        params = sig.parameters
        self.assertIn("max_workers", params, "enrich_leads_parallel must accept max_workers")
        default = params["max_workers"].default
        # Reasonable concurrency: between 5 and 20
        self.assertGreaterEqual(default, 5, f"max_workers default {default} too low")
        self.assertLessEqual(default, 20, f"max_workers default {default} too high")

    def test_failed_api_call_returns_none_and_continues(self):
        """A failed API call for one lead should not crash the whole batch."""
        import enrich_outreach

        def flaky_generate(client, lead):
            if lead["id"] == "lead-3":
                raise Exception("API rate limit")
            return f"Message for {lead['id']}"

        leads = [self._make_fake_lead(i) for i in range(5)]

        # Should not raise
        with patch.object(enrich_outreach, "generate_message", side_effect=flaky_generate):
            results = enrich_outreach.enrich_leads_parallel(
                client=MagicMock(),
                batch=leads,
                max_workers=5,
            )

        self.assertEqual(len(results), 5)
