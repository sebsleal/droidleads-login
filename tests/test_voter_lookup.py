from __future__ import annotations

import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from scrapers import voter_lookup


class VoterLookupTests(unittest.TestCase):
    def _write_voter_roll(self, directory: Path, content: str, filename: str) -> Path:
        path = directory / filename
        path.write_text(content, encoding="utf-8")
        return path

    def test_load_voter_roll_detects_comma_delimiter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            voter_path = self._write_voter_roll(
                Path(tmp_dir),
                "Name,ResidenceAddress,Phone,Email\n"
                "Maria Rodriguez,1427 SW 8th St,305-555-0101,maria@example.com\n",
                "voter_rolls.csv",
            )

            with patch.object(voter_lookup, "VOTER_ROLL_PATH", str(voter_path)):
                voter_roll = voter_lookup.load_voter_roll()

        self.assertEqual(len(voter_roll), 1)
        self.assertEqual(voter_roll[0]["Name"], "Maria Rodriguez")
        self.assertEqual(voter_roll[0]["ResidenceAddress"], "1427 SW 8th St")
        self.assertEqual(voter_roll[0]["Phone"], "305-555-0101")
        self.assertEqual(voter_roll[0]["Email"], "maria@example.com")

    def test_load_voter_roll_detects_tab_delimiter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            voter_path = self._write_voter_roll(
                Path(tmp_dir),
                "Name\tResidenceAddress\tPhone\tEmail\n"
                "Maria Rodriguez\t1427 SW 8th St\t305-555-0101\tmaria@example.com\n",
                "voter_rolls.csv",
            )

            with patch.object(voter_lookup, "VOTER_ROLL_PATH", str(voter_path)):
                voter_roll = voter_lookup.load_voter_roll()

        self.assertEqual(len(voter_roll), 1)
        self.assertEqual(voter_roll[0]["Name"], "Maria Rodriguez")
        self.assertEqual(voter_roll[0]["ResidenceAddress"], "1427 SW 8th St")
        self.assertEqual(voter_roll[0]["Phone"], "305-555-0101")
        self.assertEqual(voter_roll[0]["Email"], "maria@example.com")

    def test_enrich_with_voter_data_reads_tab_delimited_division_extract_columns(
        self,
    ) -> None:
        leads = [
            {
                "owner_name": "Maria Rodriguez",
                "address": "1427 SW 8th St",
                "contact_phone": None,
                "contact_email": None,
            }
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            voter_path = self._write_voter_roll(
                Path(tmp_dir),
                "NAMEFIRST\tNAMELAST\tRESADDR\tPHONENUMBER\tEMAILADDRESS\n"
                "Maria\tRodriguez\t1427 SW 8th St\t305-555-0101\tmaria@example.com\n",
                "voter_rolls.csv",
            )

            with patch.object(voter_lookup, "VOTER_ROLL_PATH", str(voter_path)):
                returned = voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertIs(returned, leads)
        self.assertEqual(leads[0]["contact_phone"], "305-555-0101")
        self.assertEqual(leads[0]["contact_email"], "maria@example.com")

    def test_enrich_with_voter_data_matches_name_and_address_case_insensitively(
        self,
    ) -> None:
        leads = [
            {
                "owner_name": "MARIA RODRIGUEZ",
                "address": "1427 sw 8TH st",
                "contact_phone": None,
                "contact_email": None,
            }
        ]
        voter_roll = [
            {
                "Name": "Juan Rodriguez",
                "ResidenceAddress": "1427 SW 8th St",
                "Phone": "305-555-0000",
                "Email": "juan@example.com",
            },
            {
                "Name": "Maria Rodriguez",
                "ResidenceAddress": "1427 SW 8TH ST",
                "Phone": "305-555-0101",
                "Email": "maria@example.com",
            },
        ]

        with patch.object(voter_lookup, "load_voter_roll", return_value=voter_roll):
            returned = voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertIs(returned, leads)
        self.assertEqual(leads[0]["contact_phone"], "305-555-0101")
        self.assertEqual(leads[0]["contact_email"], "maria@example.com")
        self.assertEqual(
            leads[0]["contact"],
            {"phone": "305-555-0101", "email": "maria@example.com"},
        )

    def test_enrich_with_voter_data_matches_last_first_names(self) -> None:
        leads = [
            {
                "owner_name": "RODRIGUEZ, MARIA",
                "address": "1427 SW 8th St",
                "contact_phone": None,
                "contact_email": None,
            }
        ]
        voter_roll = [
            {
                "Name": "Maria Rodriguez",
                "ResidenceAddress": "1427 SW 8th St",
                "Phone": "305-555-0101",
                "Email": "maria@example.com",
            }
        ]

        with patch.object(voter_lookup, "load_voter_roll", return_value=voter_roll):
            voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertEqual(leads[0]["contact_phone"], "305-555-0101")
        self.assertEqual(leads[0]["contact_email"], "maria@example.com")

    def test_enrich_with_voter_data_requires_address_match(self) -> None:
        leads = [
            {
                "owner_name": "Maria Rodriguez",
                "address": "1427 SW 8th St",
                "contact_phone": None,
                "contact_email": None,
            }
        ]
        voter_roll = [
            {
                "Name": "Maria Rodriguez",
                "ResidenceAddress": "1427 NW 2nd St",
                "Phone": "305-555-0101",
                "Email": "maria@example.com",
            }
        ]

        with patch.object(voter_lookup, "load_voter_roll", return_value=voter_roll):
            voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertIsNone(leads[0]["contact_phone"])
        self.assertIsNone(leads[0]["contact_email"])
        self.assertNotIn("contact", leads[0])

    def test_enrich_with_voter_data_returns_original_leads_when_file_missing(
        self,
    ) -> None:
        leads = [
            {
                "owner_name": "Maria Rodriguez",
                "address": "1427 SW 8th St",
                "contact_phone": None,
                "contact_email": None,
            }
        ]
        original = deepcopy(leads)

        with tempfile.TemporaryDirectory() as tmp_dir:
            missing_path = Path(tmp_dir) / "missing_voter_roll.tsv"
            with patch.object(voter_lookup, "VOTER_ROLL_PATH", str(missing_path)):
                with patch("builtins.print") as mock_print:
                    returned = voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertIs(returned, leads)
        self.assertEqual(leads, original)
        mock_print.assert_any_call("[voter] No voter roll data found. Skipping voter enrichment.")
        mock_print.assert_any_call(
            "[voter] To enable: place FL voter roll CSV at data/voter_rolls.csv"
        )

    def test_enrich_with_voter_data_skips_business_entities(self) -> None:
        leads = [
            {
                "owner_name": "SMITH CORP LLC",
                "address": "1427 SW 8th St",
                "contact_phone": None,
                "contact_email": None,
            }
        ]
        voter_roll = [
            {
                "Name": "Smith Corp LLC",
                "ResidenceAddress": "1427 SW 8th St",
                "Phone": "305-555-0101",
                "Email": "corp@example.com",
            }
        ]

        with patch.object(voter_lookup, "load_voter_roll", return_value=voter_roll):
            returned = voter_lookup.enrich_with_voter_data(leads, top_n=10)

        self.assertIs(returned, leads)
        self.assertIsNone(leads[0]["contact_phone"])
        self.assertIsNone(leads[0]["contact_email"])
        self.assertNotIn("contact", leads[0])


if __name__ == "__main__":
    unittest.main()
