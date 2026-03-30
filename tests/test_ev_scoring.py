"""
Tests for EV model integration into company_scoring.py.

Covers VAL-SCORE-001 through VAL-SCORE-006:
  - VAL-SCORE-001: compute_ev() called during scoring, influences final score
  - VAL-SCORE-002: DEFAULT modifiers align with companyMetrics.json
  - VAL-SCORE-003: Score distribution has spread at top (no ceiling saturation)
  - VAL-SCORE-004: Recency decay is smooth (no >5-point jump between adjacent days)
  - VAL-SCORE-005: Contact quality differentiation (phone+email > email-only > no contact)
  - VAL-SCORE-006: Score breakdown includes EV component
"""

from __future__ import annotations

import json
import math
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from enrichment.company_scoring import (
    DEFAULT_INSURER_MODIFIERS,
    DEFAULT_PERIL_MODIFIERS,
    _score_with_breakdown,
    score_leads_batch,
)


COMPANY_METRICS_PATH = (
    Path(__file__).resolve().parents[1] / "src" / "data" / "companyMetrics.json"
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


class EVContributesToScoreTests(unittest.TestCase):
    """VAL-SCORE-001: compute_ev() is called and influences the final score."""

    def test_compute_ev_is_called_during_scoring(self) -> None:
        """compute_ev() must be called by _score_with_breakdown()."""
        lead = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
        )
        with patch("enrichment.company_scoring.compute_ev") as mock_ev:
            mock_ev.return_value = 0.0
            _score_with_breakdown(lead)
            mock_ev.assert_called_once()

    def test_ev_influences_final_score(self) -> None:
        """Score should differ when compute_ev returns 0 vs a real value."""
        lead = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
        )

        with patch("enrichment.company_scoring.compute_ev", return_value=0.0):
            score_zero_ev, _ = _score_with_breakdown(lead)

        with patch("enrichment.company_scoring.compute_ev", return_value=5000.0):
            score_high_ev, _ = _score_with_breakdown(lead)

        self.assertGreater(
            score_high_ev,
            score_zero_ev,
            "Score with high EV should exceed score with EV=0",
        )


class EVBreakdownTests(unittest.TestCase):
    """VAL-SCORE-006: Score breakdown includes 'Expected Value' factor with non-zero delta."""

    def test_breakdown_contains_ev_factor(self) -> None:
        """Breakdown factors list must include a factor containing 'EV' or 'Expected Value'."""
        lead = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
        )
        _, breakdown = _score_with_breakdown(lead)
        factors = breakdown.get("factors", [])
        ev_factors = [
            f for f in factors
            if "ev" in f.get("label", "").lower() or "expected value" in f.get("label", "").lower()
        ]
        self.assertTrue(
            len(ev_factors) > 0,
            f"No EV factor found in breakdown. Factors: {[f['label'] for f in factors]}",
        )

    def test_ev_factor_has_nonzero_delta(self) -> None:
        """EV factor in breakdown must have a non-zero delta for a solid lead."""
        lead = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
        )
        _, breakdown = _score_with_breakdown(lead)
        factors = breakdown.get("factors", [])
        ev_factors = [
            f for f in factors
            if "ev" in f.get("label", "").lower() or "expected value" in f.get("label", "").lower()
        ]
        self.assertTrue(len(ev_factors) > 0, "No EV factor found in breakdown")
        ev_delta = ev_factors[0].get("delta", 0)
        self.assertNotEqual(ev_delta, 0, "EV factor delta should be non-zero for a solid lead")


class DefaultModifierAlignmentTests(unittest.TestCase):
    """VAL-SCORE-002: Default modifiers match companyMetrics.json scoring_model values."""

    def setUp(self) -> None:
        with open(COMPANY_METRICS_PATH, encoding="utf-8") as f:
            self.metrics = json.load(f)
        self.scoring_model = self.metrics.get("scoring_model", {})

    def test_insurer_modifiers_match_company_metrics(self) -> None:
        """Every insurer in companyMetrics.json insurer_modifiers should be in DEFAULT_INSURER_MODIFIERS with matching score_modifier."""
        insurer_modifiers_from_json = self.scoring_model.get("insurer_modifiers", {})
        mismatches = []
        for insurer_key, json_payload in insurer_modifiers_from_json.items():
            json_score = json_payload.get("score_modifier")
            # Look up in DEFAULT_INSURER_MODIFIERS (case-insensitive key match)
            default_entry = None
            for default_key, default_payload in DEFAULT_INSURER_MODIFIERS.items():
                if default_key.lower() == insurer_key.lower():
                    default_entry = default_payload
                    break
            if default_entry is None:
                mismatches.append(f"'{insurer_key}' missing from DEFAULT_INSURER_MODIFIERS")
            elif default_entry.get("score_modifier") != json_score:
                mismatches.append(
                    f"'{insurer_key}': DEFAULT={default_entry.get('score_modifier')}, JSON={json_score}"
                )
        self.assertEqual(
            mismatches,
            [],
            f"DEFAULT_INSURER_MODIFIERS mismatches with companyMetrics.json:\n"
            + "\n".join(mismatches),
        )

    def test_peril_modifiers_match_company_metrics(self) -> None:
        """Every peril in companyMetrics.json peril_weights should be in DEFAULT_PERIL_MODIFIERS with matching score_modifier."""
        peril_weights_from_json = self.scoring_model.get("peril_weights", {})
        mismatches = []
        for peril_key, json_payload in peril_weights_from_json.items():
            json_score = json_payload.get("score_modifier")
            default_score = DEFAULT_PERIL_MODIFIERS.get(peril_key)
            if default_score is None:
                mismatches.append(f"'{peril_key}' missing from DEFAULT_PERIL_MODIFIERS")
            elif default_score != json_score:
                mismatches.append(
                    f"'{peril_key}': DEFAULT={default_score}, JSON={json_score}"
                )
        self.assertEqual(
            mismatches,
            [],
            f"DEFAULT_PERIL_MODIFIERS mismatches with companyMetrics.json:\n"
            + "\n".join(mismatches),
        )


class ScoreDistributionTests(unittest.TestCase):
    """VAL-SCORE-003: Top leads should have distinguishable scores (no ceiling saturation)."""

    def _make_graduated_lead(self, quality_level: int) -> dict:
        """
        Make a lead with quality from 0 (low) to 10 (high).
        Each level adds progressively more favorable attributes.
        """
        lead = _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
            permit_date=(date.today() - timedelta(days=5)).isoformat(),
        )
        if quality_level >= 1:
            lead["contact_email"] = "owner@test.com"
        if quality_level >= 2:
            lead["contact_phone"] = "305-555-1234"
        if quality_level >= 3:
            lead["storm_event"] = "Hurricane Test"
        if quality_level >= 4:
            lead["source_detail"] = "storm_first"
        if quality_level >= 5:
            lead["underpaid_flag"] = True
        if quality_level >= 6:
            lead["homestead"] = True
        if quality_level >= 7:
            lead["permit_value"] = 50000
        if quality_level >= 8:
            lead["assessed_value"] = 600000
        if quality_level >= 9:
            lead["prior_permit_count"] = 2
        if quality_level >= 10:
            lead["fema_declaration_number"] = "DR-4000"
            lead["roof_age"] = 20
        return lead

    def test_top_leads_not_saturated(self) -> None:
        """Top leads of varying quality should have distinguishable scores — no saturation to 100."""
        # Create leads at 11 quality levels (0 through 10)
        leads = [self._make_graduated_lead(q) for q in range(11)]
        scored = score_leads_batch(leads)
        scores = sorted([lead["score"] for lead in scored], reverse=True)
        # The top 3 highest-quality leads should have distinguishable scores
        top_scores = scores[:3]
        unique_top_scores = set(top_scores)
        self.assertGreater(
            len(unique_top_scores),
            1,
            f"Top 3 scores are the same ({top_scores}). Score ceiling saturation detected.",
        )

    def test_scores_not_all_100(self) -> None:
        """No batch of diverse leads should result in all scores being 100."""
        leads = [self._make_graduated_lead(q) for q in range(11)]
        scored = score_leads_batch(leads)
        scores = [lead["score"] for lead in scored]
        all_100 = all(s == 100 for s in scores)
        self.assertFalse(
            all_100,
            f"All {len(scores)} leads scored 100 — logarithmic compression not working.",
        )


class RecencyDecaySmoothnessTests(unittest.TestCase):
    """VAL-SCORE-004: Recency decay smooth — no >5-point jump between adjacent days."""

    def _lead_for_day(self, days_ago: int) -> dict:
        """Build a lead with a permit that is `days_ago` days old."""
        return _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
            permit_date=(date.today() - timedelta(days=days_ago)).isoformat(),
        )

    def test_no_large_jump_between_adjacent_days(self) -> None:
        """No adjacent-day pair should produce a >5-point difference in score."""
        # Test across a wide range (day 0 to day 120)
        scores = []
        for d in range(0, 121):
            lead = self._lead_for_day(d)
            score, _ = _score_with_breakdown(lead)
            scores.append(score)

        max_jump = 0
        worst_pair = (0, 0)
        for i in range(1, len(scores)):
            jump = abs(scores[i] - scores[i - 1])
            if jump > max_jump:
                max_jump = jump
                worst_pair = (i - 1, i)

        self.assertLessEqual(
            max_jump,
            5,
            f"Score jumped {max_jump} points between day {worst_pair[0]} and day {worst_pair[1]}. "
            f"Score at day {worst_pair[0]}: {scores[worst_pair[0]]}, "
            f"Score at day {worst_pair[1]}: {scores[worst_pair[1]]}. "
            f"Smooth exponential decay required.",
        )

    def test_recent_leads_score_higher_than_old(self) -> None:
        """Leads filed within 30 days should score higher than leads filed 90+ days ago."""
        fresh = self._lead_for_day(5)
        old = self._lead_for_day(95)
        fresh_score, _ = _score_with_breakdown(fresh)
        old_score, _ = _score_with_breakdown(old)
        self.assertGreater(
            fresh_score,
            old_score,
            f"Fresh lead ({fresh_score}) should score higher than old lead ({old_score}).",
        )


class ContactQualityDifferentiationTests(unittest.TestCase):
    """VAL-SCORE-005: phone+email > email-only > no contact."""

    def _base_lead(self) -> dict:
        """Build a lead with no contact info."""
        return _lead(
            damage_type="Accidental Discharge",
            insurance_company="Tower Hill",
            permit_date=(date.today() - timedelta(days=10)).isoformat(),
        )

    def test_phone_and_email_beats_email_only(self) -> None:
        """Lead with phone+email should score higher than lead with email only."""
        no_contact = self._base_lead()
        email_only = {**self._base_lead(), "contact_email": "owner@test.com"}
        phone_and_email = {
            **self._base_lead(),
            "contact_phone": "305-555-1234",
            "contact_email": "owner@test.com",
        }

        score_no_contact, _ = _score_with_breakdown(no_contact)
        score_email_only, _ = _score_with_breakdown(email_only)
        score_both, _ = _score_with_breakdown(phone_and_email)

        self.assertGreater(
            score_both,
            score_email_only,
            f"phone+email ({score_both}) should beat email-only ({score_email_only}).",
        )
        self.assertGreater(
            score_email_only,
            score_no_contact,
            f"email-only ({score_email_only}) should beat no-contact ({score_no_contact}).",
        )

    def test_three_tiers_are_distinguishable(self) -> None:
        """Three contact tiers must produce strictly ordered scores."""
        no_contact = self._base_lead()
        email_only = {**self._base_lead(), "contact_email": "owner@test.com"}
        phone_and_email = {
            **self._base_lead(),
            "contact_phone": "305-555-1234",
            "contact_email": "owner@test.com",
        }

        s_none, _ = _score_with_breakdown(no_contact)
        s_email, _ = _score_with_breakdown(email_only)
        s_both, _ = _score_with_breakdown(phone_and_email)

        self.assertGreater(s_both, s_email)
        self.assertGreater(s_email, s_none)


if __name__ == "__main__":
    unittest.main()
