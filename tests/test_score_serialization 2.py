"""
Tests for score serialization precision in pipeline/leads.py.

Ensures that fractional scores survive canonicalization and JSON serialization
so that top-decile leads remain distinguishable in the output.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from enrichment.company_scoring import _score_with_breakdown, score_leads_batch
from pipeline.leads import (
    canonicalize_lead,
    serialize_lead_for_ui,
    write_leads_json,
)


def _lead(**kwargs) -> dict:
    """Build a minimal canonical lead dict for testing."""
    base = {
        "address": "123 Test St",
        "city": "Miami",
        "zip": "33101",
        "permit_date": date.today().isoformat(),
        "source": "permit",
        "source_detail": "permit",
    }
    base.update(kwargs)
    return base


class CanonicalizeLeadScorePrecisionTests(unittest.TestCase):
    """canonicalize_lead must preserve fractional scores (not truncate to int)."""

    def test_canonicalize_preserves_float_score(self) -> None:
        """A raw lead with score=87.3 must retain 87.3, not become 87."""
        raw = _lead(score=87.3)
        canonical = canonicalize_lead(raw)
        self.assertIsInstance(canonical["score"], float)
        self.assertAlmostEqual(canonical["score"], 87.3, places=1)

    def test_canonicalize_preserves_one_decimal_place(self) -> None:
        """Score with many decimal places is rounded to 1 decimal."""
        raw = _lead(score=92.6789)
        canonical = canonicalize_lead(raw)
        self.assertEqual(canonical["score"], round(92.6789, 1))

    def test_canonicalize_zero_score_remains_numeric(self) -> None:
        """A score of 0 should remain 0 (not error out)."""
        raw = _lead(score=0)
        canonical = canonicalize_lead(raw)
        self.assertEqual(canonical["score"], 0)

    def test_canonicalize_none_score_becomes_zero(self) -> None:
        """A missing/None score should default to 0."""
        raw = _lead()
        raw.pop("score", None)
        canonical = canonicalize_lead(raw)
        self.assertEqual(canonical["score"], 0)


class SerializeLeadScorePrecisionTests(unittest.TestCase):
    """serialize_lead_for_ui must preserve fractional scores."""

    def test_serialize_preserves_float_score(self) -> None:
        """Serialized UI payload must keep the float score, not truncate to int."""
        lead = canonicalize_lead(_lead(score=93.7))
        ui = serialize_lead_for_ui(lead)
        self.assertIsInstance(ui["score"], float)
        self.assertAlmostEqual(ui["score"], 93.7, places=1)

    def test_serialize_preserves_fractional_difference(self) -> None:
        """Two leads with scores 98.2 and 98.7 must serialize to different values."""
        lead_a = canonicalize_lead(_lead(score=98.2, address="100 A St"))
        lead_b = canonicalize_lead(_lead(score=98.7, address="200 B St"))
        ui_a = serialize_lead_for_ui(lead_a)
        ui_b = serialize_lead_for_ui(lead_b)
        self.assertNotEqual(
            ui_a["score"],
            ui_b["score"],
            f"Scores 98.2 and 98.7 must serialize to different values, "
            f"got {ui_a['score']} and {ui_b['score']}",
        )


class WriteLeadsJsonScorePrecisionTests(unittest.TestCase):
    """write_leads_json must produce JSON with distinguishable fractional scores."""

    def test_json_output_preserves_fractional_scores(self) -> None:
        """Scores that differ by <1 point must remain distinguishable in the JSON output."""
        lead_a = canonicalize_lead(_lead(score=95.1, address="100 A St"))
        lead_b = canonicalize_lead(_lead(score=95.8, address="200 B St"))

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "leads.json"
            write_leads_json([lead_a, lead_b], output_path=output_path)

            payload = json.loads(output_path.read_text(encoding="utf-8"))
            scores = [lead["score"] for lead in payload["leads"]]

        self.assertEqual(len(scores), 2)
        self.assertNotEqual(
            scores[0],
            scores[1],
            f"Scores that differ by <1 point must remain distinct in JSON. "
            f"Got: {scores}",
        )

    def test_json_scores_are_floats_not_ints(self) -> None:
        """Score values in JSON output must be floats, not truncated to int."""
        lead = canonicalize_lead(_lead(score=88.4))

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "leads.json"
            write_leads_json([lead], output_path=output_path)

            payload = json.loads(output_path.read_text(encoding="utf-8"))
            score = payload["leads"][0]["score"]

        self.assertIsInstance(score, float)
        self.assertAlmostEqual(score, 88.4, places=1)


class EndToEndScoringSerializationTests(unittest.TestCase):
    """Integration: score via the real scoring engine, then serialize and verify precision."""

    def test_scored_leads_preserve_fractional_scores_through_serialization(self) -> None:
        """Score 2+ high-value leads through scoring + serialization and verify
        the JSON output has distinguishable (non-equal) scores when raw scores differ by <1 point."""
        # Build two leads that differ only in recency (should produce close but distinct scores)
        lead_a = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
            permit_date=(date.today() - timedelta(days=1)).isoformat(),
            contact_phone="305-555-1234",
            contact_email="owner@test.com",
            storm_event="Hurricane Test",
            source_detail="storm_first",
            underpaid_flag=True,
            homestead=True,
            permit_value=50000,
            assessed_value=600000,
            prior_permit_count=2,
            fema_declaration_number="DR-4000",
            roof_age=20,
            address="100 Top Lead Ave",
        )
        lead_b = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
            permit_date=(date.today() - timedelta(days=5)).isoformat(),
            contact_phone="305-555-1234",
            contact_email="owner@test.com",
            storm_event="Hurricane Test",
            source_detail="storm_first",
            underpaid_flag=True,
            homestead=True,
            permit_value=50000,
            assessed_value=600000,
            prior_permit_count=2,
            fema_declaration_number="DR-4000",
            roof_age=20,
            address="200 Top Lead Blvd",
        )

        # Score both leads
        scored = score_leads_batch([lead_a, lead_b])
        raw_scores = [lead["score"] for lead in scored]

        # Verify the raw scores differ (recency difference should cause <1 point gap)
        self.assertNotEqual(
            raw_scores[0],
            raw_scores[1],
            "Raw scored leads should have different scores due to recency difference",
        )

        # Canonicalize and serialize through the full pipeline path
        canonicalized = [canonicalize_lead(lead) for lead in scored]
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "leads.json"
            write_leads_json(canonicalized, output_path=output_path)

            payload = json.loads(output_path.read_text(encoding="utf-8"))
            json_scores = [lead["score"] for lead in payload["leads"]]

        unique_scores = set(json_scores)
        self.assertGreater(
            len(unique_scores),
            1,
            f"Serialized JSON scores should be distinguishable. "
            f"Got: {json_scores} (all equal). "
            f"Raw scores were: {raw_scores}. "
            f"The int() cast in serialization is truncating fractional differences.",
        )


if __name__ == "__main__":
    unittest.main()
