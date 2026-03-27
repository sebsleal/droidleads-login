from __future__ import annotations

import unittest
from datetime import date

from company_data.metrics import build_claims_metrics
from enrichment.company_scoring import get_insurer_risk, get_peril_signal


class CompanyMetricsTests(unittest.TestCase):
    def test_monthly_fees_are_sorted_by_month_key(self) -> None:
        metrics = build_claims_metrics(
            [
                {
                    "status_normalized": "Settled",
                    "peril_normalized": "Roof",
                    "claim_family": "roof",
                    "insurance_company_normalized": "Carrier A",
                    "fee_disbursed_value": 1000.0,
                    "loss_date_value": date(2025, 3, 10),
                    "date_logged_value": date(2025, 3, 15),
                },
                {
                    "status_normalized": "Settled",
                    "peril_normalized": "Roof",
                    "claim_family": "roof",
                    "insurance_company_normalized": "Carrier A",
                    "fee_disbursed_value": 500.0,
                    "loss_date_value": date(2025, 1, 2),
                    "date_logged_value": date(2025, 1, 20),
                },
            ]
        )

        self.assertEqual(
            [row["month_key"] for row in metrics["monthly_fees"]],
            ["2025-01", "2025-03"],
        )

    def test_company_scoring_uses_real_derived_peril_and_insurer_signals(self) -> None:
        accidental = get_peril_signal("Accidental Discharge")
        hurricane = get_peril_signal("Hurricane/Wind")
        progressive = get_insurer_risk("Progressive")
        citizens = get_insurer_risk("Citizens Property Insurance")

        self.assertIsNotNone(accidental)
        self.assertIsNotNone(hurricane)
        self.assertIsNotNone(progressive)
        self.assertIsNotNone(citizens)
        self.assertGreater(accidental["sample_size"], 0)
        self.assertGreater(accidental["score_modifier"], hurricane["score_modifier"])
        self.assertEqual(progressive["risk"], "low")
        self.assertEqual(citizens["risk"], "high")


if __name__ == "__main__":
    unittest.main()
