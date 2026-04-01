"""Tests for db/insert.py — new columns: expected_value, score_breakdown, outreach_sent_at."""

import unittest
import sys
import os
from unittest.mock import MagicMock, patch

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import db.insert once; since websockets.asyncio is now available,
# the import chain succeeds.
import db.insert  # noqa: E402


def _make_lead(**overrides):
    base = {
        "dedup_hash": "abc123",
        "owner_name": "Test Owner",
        "address": "123 Test St",
        "city": "Miami",
        "zip": "33101",
        "damage_type": "Hurricane/Wind",
        "permit_date": "2026-03-01",
        "source": "permit",
    }
    base.update(overrides)
    return base


class TestUpsertLeadsNewColumns(unittest.TestCase):
    """Verify upsert_leads() includes new enrichment columns when present and omits them when None."""

    def _capture_rows(self, leads, mock_client):
        """Call upsert_leads and return the rows passed to the mock upsert call."""
        captured = []

        def capture_fn(rows, **kwargs):
            captured.extend(list(rows))
            return MagicMock(execute=MagicMock(return_value=MagicMock(data=[{"id": "abc123"}])))

        mock_client.table.return_value.upsert.side_effect = capture_fn
        db.insert.upsert_leads(leads, supabase=mock_client)
        return captured

    def test_expected_value_included_when_present(self):
        """expected_value is included in the upsert payload when lead carries a non-None value."""
        mock_client = MagicMock()
        rows = self._capture_rows([_make_lead(expected_value=5000)], mock_client)
        self.assertIn("expected_value", rows[0])
        self.assertEqual(rows[0]["expected_value"], 5000)

    def test_score_breakdown_included_when_present(self):
        """score_breakdown dict is included in the upsert payload when lead carries a non-None value."""
        mock_client = MagicMock()
        breakdown = {"base": 30, "homestead_bonus": 20, "final": 50}
        rows = self._capture_rows([_make_lead(score_breakdown=breakdown)], mock_client)
        self.assertIn("score_breakdown", rows[0])
        self.assertEqual(rows[0]["score_breakdown"], breakdown)

    def test_outreach_sent_at_included_when_present(self):
        """outreach_sent_at is included when lead carries a non-None value."""
        mock_client = MagicMock()
        sent_at = "2026-03-30T14:00:00Z"
        rows = self._capture_rows([_make_lead(outreach_sent_at=sent_at)], mock_client)
        self.assertIn("outreach_sent_at", rows[0])
        self.assertEqual(rows[0]["outreach_sent_at"], sent_at)

    def test_outreach_sent_at_camel_case_alias_included(self):
        """outreachSentAt (camelCase) is accepted as an alias for outreach_sent_at."""
        mock_client = MagicMock()
        sent_at = "2026-03-30T15:00:00Z"
        rows = self._capture_rows([_make_lead(outreachSentAt=sent_at)], mock_client)
        self.assertIn("outreach_sent_at", rows[0])
        self.assertEqual(rows[0]["outreach_sent_at"], sent_at)

    def test_expected_value_omitted_when_none(self):
        """expected_value is NOT in the payload when lead has no expected_value key."""
        mock_client = MagicMock()
        rows = self._capture_rows([_make_lead()], mock_client)
        self.assertNotIn("expected_value", rows[0])

    def test_score_breakdown_omitted_when_none(self):
        """score_breakdown is NOT in the payload when lead has no score_breakdown."""
        mock_client = MagicMock()
        rows = self._capture_rows([_make_lead()], mock_client)
        self.assertNotIn("score_breakdown", rows[0])

    def test_outreach_sent_at_omitted_when_none(self):
        """outreach_sent_at is NOT in the payload when lead has no outreach_sent_at or outreachSentAt."""
        mock_client = MagicMock()
        rows = self._capture_rows([_make_lead()], mock_client)
        self.assertNotIn("outreach_sent_at", rows[0])

    def test_all_three_new_fields_together(self):
        """When all three new fields are present, all three are included in the payload."""
        mock_client = MagicMock()
        rows = self._capture_rows(
            [_make_lead(
                expected_value=7500,
                score_breakdown={"base": 30, "final": 75},
                outreach_sent_at="2026-03-30T16:00:00Z",
            )],
            mock_client,
        )
        self.assertEqual(rows[0]["expected_value"], 7500)
        self.assertEqual(rows[0]["score_breakdown"], {"base": 30, "final": 75})
        self.assertEqual(rows[0]["outreach_sent_at"], "2026-03-30T16:00:00Z")


if __name__ == "__main__":
    unittest.main()
