from __future__ import annotations

import unittest
from unittest.mock import patch

from enrichment.outreach_prompt import (
    _fallback_template,
    _salutation_name,
    build_outreach_prompt,
)


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


class OutreachPhoneConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.lead = {
            "owner_name": "Mendoza",
            "address": "1427 SW 8th St",
            "city": "Miami",
            "zip": "33135",
            "damage_type": "Hurricane/Wind",
            "permit_type": "Roof Replacement",
            "permit_date": "2026-03-10",
            "storm_event": "Hurricane Helene (Sept 2025)",
        }

    @patch.dict("os.environ", {"OUTREACH_PHONE": "(305) 555-1234"}, clear=False)
    def test_fallback_template_uses_configured_phone(self) -> None:
        self.assertIn("(305) 555-1234", _fallback_template(self.lead))

    @patch.dict("os.environ", {}, clear=True)
    def test_fallback_template_uses_default_placeholder_when_env_unset(self) -> None:
        self.assertIn("(800) 555-0100", _fallback_template(self.lead))

    @patch.dict("os.environ", {"OUTREACH_PHONE": "(305) 555-1234"}, clear=False)
    def test_build_outreach_prompt_includes_configured_phone_in_cta(self) -> None:
        prompt = build_outreach_prompt(self.lead)

        self.assertIn("(305) 555-1234", prompt)
        self.assertIn("call or text us at (305) 555-1234", prompt)


if __name__ == "__main__":
    unittest.main()
