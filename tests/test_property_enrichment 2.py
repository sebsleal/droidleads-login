from __future__ import annotations

import unittest
from unittest.mock import patch

from scrapers.property import enrich_leads_with_owner_info


class PropertyEnrichmentTests(unittest.TestCase):
    def _pa_info(self) -> dict[str, object]:
        return {
            "owner_name": "Jamie Example",
            "mailing_address": "123 Mailing St",
            "mailing_city": "Miami",
            "mailing_state": "FL",
            "mailing_zip": "33139",
            "site_zip": "33133",
            "homestead": True,
            "assessed_value": 450000,
            "roof_age": 22,
        }

    def test_enrich_leads_with_owner_info_overwrites_none_values(self) -> None:
        lead = {
            "folio_number": "01-1111-111-1111",
            "address": "456 Opportunity Ave",
            "zip": None,
            "owner_mailing_address": None,
            "homestead": None,
            "assessed_value": None,
            "roof_age": None,
        }

        with patch("scrapers.property.lookup_by_folio", return_value=self._pa_info()):
            enrich_leads_with_owner_info([lead], delay=0)

        self.assertEqual(lead["zip"], "33133")
        self.assertEqual(
            lead["owner_mailing_address"],
            "123 Mailing St, Miami, FL 33139",
        )
        self.assertIs(lead["homestead"], True)
        self.assertEqual(lead["assessed_value"], 450000)
        self.assertEqual(lead["roof_age"], 22)

    def test_enrich_leads_with_owner_info_preserves_existing_non_none_values(
        self,
    ) -> None:
        lead = {
            "folio_number": "01-1111-111-1112",
            "address": "789 Preserve Ln",
            "zip": "",
            "owner_mailing_address": "Existing Mailing Address",
            "homestead": False,
            "assessed_value": 275000,
            "roof_age": 9,
        }

        with patch("scrapers.property.lookup_by_folio", return_value=self._pa_info()):
            enrich_leads_with_owner_info([lead], delay=0)

        self.assertEqual(lead["zip"], "")
        self.assertEqual(lead["owner_mailing_address"], "Existing Mailing Address")
        self.assertIs(lead["homestead"], False)
        self.assertEqual(lead["assessed_value"], 275000)
        self.assertEqual(lead["roof_age"], 9)

    def test_enrich_leads_with_owner_info_populates_missing_keys(self) -> None:
        lead = {
            "folio_number": "01-1111-111-1113",
            "address": "321 Missing Keys Blvd",
        }

        with patch("scrapers.property.lookup_by_folio", return_value=self._pa_info()):
            enrich_leads_with_owner_info([lead], delay=0)

        self.assertEqual(lead["zip"], "33133")
        self.assertEqual(
            lead["owner_mailing_address"],
            "123 Mailing St, Miami, FL 33139",
        )
        self.assertIs(lead["homestead"], True)
        self.assertEqual(lead["assessed_value"], 450000)
        self.assertEqual(lead["roof_age"], 22)

    def test_enrich_leads_with_owner_info_skips_empty_or_none_folio(self) -> None:
        leads = [
            {"folio_number": None, "address": "No Folio"},
            {"folio_number": "", "address": "Blank Folio"},
            {"address": "Missing Folio"},
        ]

        with patch("scrapers.property.lookup_by_folio") as mock_lookup:
            returned = enrich_leads_with_owner_info(leads, delay=0)

        self.assertIs(returned, leads)
        mock_lookup.assert_not_called()


if __name__ == "__main__":
    unittest.main()
