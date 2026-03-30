from __future__ import annotations

import unittest

from enrichment.outreach_prompt import _salutation_name


class SalutationNameTests(unittest.TestCase):
    def test_salutation_name_handles_comma_separated_last_first(self) -> None:
        self.assertEqual(_salutation_name("RODRIGUEZ, MARIA"), "Rodriguez")

    def test_salutation_name_preserves_first_last_behavior(self) -> None:
        self.assertEqual(_salutation_name("Maria Rodriguez"), "Rodriguez")

    def test_salutation_name_returns_property_owner_for_entities_and_blanks(self) -> None:
        self.assertEqual(_salutation_name("SMITH CORP LLC"), "Property Owner")
        self.assertEqual(_salutation_name(None), "Property Owner")
        self.assertEqual(_salutation_name(""), "Property Owner")
        self.assertEqual(_salutation_name("reference only"), "Property Owner")

    def test_salutation_name_handles_single_word_names(self) -> None:
        self.assertEqual(_salutation_name("MENDOZA"), "Mendoza")

    def test_salutation_name_strips_common_suffixes(self) -> None:
        self.assertEqual(_salutation_name("RODRIGUEZ JR"), "Rodriguez")
        self.assertEqual(_salutation_name("RODRIGUEZ SR."), "Rodriguez")
        self.assertEqual(_salutation_name("RODRIGUEZ III"), "Rodriguez")


if __name__ == "__main__":
    unittest.main()
