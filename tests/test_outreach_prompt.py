from __future__ import annotations

import unittest
from unittest.mock import patch

from enrichment.outreach_prompt import (
    _fallback_template,
    _salutation_name,
    build_outreach_prompt,
    validate_outreach_message,
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


class OutreachPromptEnrichmentSignalTests(unittest.TestCase):
    """Tests for VAL-OUT-001 through VAL-OUT-004: enrichment signals in build_outreach_prompt."""

    def _base_lead(self) -> dict:
        return {
            "owner_name": "Hernandez",
            "address": "3210 NW 7th Ave",
            "city": "Miami",
            "zip": "33127",
            "damage_type": "Hurricane/Wind",
            "permit_type": "Roof Replacement",
            "permit_date": "2026-03-01",
        }

    # VAL-OUT-001: FEMA declaration
    def test_prompt_includes_fema_declaration_when_present(self) -> None:
        """When lead has fema_declaration_number, prompt contains that number and/or 'FEMA'."""
        lead = {**self._base_lead(), "fema_declaration_number": "DR-4709-FL"}
        prompt = build_outreach_prompt(lead)
        self.assertTrue(
            "DR-4709-FL" in prompt or "FEMA" in prompt,
            "Prompt should reference the FEMA declaration number or 'FEMA'",
        )

    def test_prompt_excludes_fema_section_when_absent(self) -> None:
        """When lead has no fema_declaration_number, prompt should not mention FEMA."""
        lead = self._base_lead()  # no fema_declaration_number key
        prompt = build_outreach_prompt(lead)
        # FEMA should not appear in a plain lead without a FEMA declaration
        self.assertNotIn("DR-", prompt, "No FEMA declaration ref expected")

    # VAL-OUT-002: Permit status
    def test_prompt_includes_permit_status_when_present(self) -> None:
        """When lead has permit_status, prompt references that status."""
        for status in ("Owner-Builder", "Stalled", "No Contractor"):
            with self.subTest(status=status):
                lead = {**self._base_lead(), "permit_status": status}
                prompt = build_outreach_prompt(lead)
                self.assertIn(
                    status,
                    prompt,
                    f"Prompt should contain permit_status value '{status}'",
                )

    def test_prompt_excludes_permit_status_when_absent(self) -> None:
        """When lead has no permit_status, prompt should not include a permit status line."""
        lead = self._base_lead()
        prompt = build_outreach_prompt(lead)
        self.assertNotIn("Owner-Builder", prompt)
        self.assertNotIn("Stalled", prompt)
        self.assertNotIn("No Contractor", prompt)

    # VAL-OUT-003: Underpayment flag
    def test_prompt_includes_underpayment_context_when_flagged(self) -> None:
        """When lead has underpaid_flag=True, prompt includes underpayment language."""
        lead = {**self._base_lead(), "underpaid_flag": True}
        prompt = build_outreach_prompt(lead)
        underpayment_terms = ("underpaid", "underpayment", "under-paid", "under-payment")
        self.assertTrue(
            any(term in prompt.lower() for term in underpayment_terms),
            "Prompt should include underpayment context when underpaid_flag=True",
        )

    def test_prompt_excludes_underpayment_context_when_not_flagged(self) -> None:
        """When lead has underpaid_flag=False or absent, prompt should not mention underpayment."""
        for flag_value in (False, None):
            with self.subTest(underpaid_flag=flag_value):
                lead = {**self._base_lead()}
                if flag_value is not None:
                    lead["underpaid_flag"] = flag_value
                prompt = build_outreach_prompt(lead)
                underpayment_terms = ("underpaid", "underpayment")
                self.assertFalse(
                    any(term in prompt.lower() for term in underpayment_terms),
                    "Prompt should NOT mention underpayment when flag is absent/False",
                )

    # VAL-OUT-004: Insurer name
    def test_prompt_includes_insurer_name_when_present(self) -> None:
        """When lead has insurance_company, prompt references the insurer name."""
        lead = {
            **self._base_lead(),
            "insurance_company": "Citizens Property Insurance",
            "insurer_risk": "high",
        }
        prompt = build_outreach_prompt(lead)
        self.assertIn(
            "Citizens Property Insurance",
            prompt,
            "Prompt should mention the insurance company",
        )

    def test_prompt_includes_insurer_without_insurer_risk(self) -> None:
        """Insurer name is included even when insurer_risk is absent."""
        lead = {**self._base_lead(), "insurance_company": "Universal Property"}
        prompt = build_outreach_prompt(lead)
        self.assertIn("Universal Property", prompt)

    def test_prompt_excludes_insurer_section_when_absent(self) -> None:
        """When lead has no insurance_company, prompt should not add an insurer line."""
        lead = self._base_lead()
        prompt = build_outreach_prompt(lead)
        # Should not contain placeholder insurer references
        self.assertNotIn("Insurer:", prompt)
        self.assertNotIn("Insurance company:", prompt)


class ValidateOutreachMessageTests(unittest.TestCase):
    """Tests for VAL-OUT-005 and VAL-OUT-006: validate_outreach_message()."""

    def _valid_message(self, address: str = "3210 NW 7th Ave") -> str:
        return (
            f"Dear Hernandez, our records show your property at {address} may have "
            "sustained hurricane damage. As a licensed Florida public adjuster, "
            "Claim Remedy Adjusters specializes in maximizing insurance settlements. "
            "Please call us at (800) 555-0100 for a free inspection."
        )

    def _base_lead(self) -> dict:
        return {
            "address": "3210 NW 7th Ave",
            "city": "Miami",
            "zip": "33127",
        }

    # VAL-OUT-005: minimum length
    def test_validate_rejects_messages_under_100_chars(self) -> None:
        """Messages under 100 characters must be rejected."""
        short_msg = "Dear Owner, please call us."
        lead = self._base_lead()
        self.assertFalse(
            validate_outreach_message(short_msg, lead),
            "Messages under 100 chars should fail validation",
        )

    def test_validate_accepts_messages_over_100_chars_with_address(self) -> None:
        """Well-formed messages (≥100 chars, address present) must pass."""
        lead = self._base_lead()
        self.assertTrue(
            validate_outreach_message(self._valid_message(), lead),
            "Valid, long message with address should pass validation",
        )

    def test_validate_rejects_exactly_99_chars(self) -> None:
        """A message of exactly 99 characters should be rejected."""
        lead = {**self._base_lead(), "address": "X"}
        # Construct a 99-char message containing the address "X"
        base = "Dear Owner, call us about your property at X: "
        msg_99 = (base + "a" * (99 - len(base))).ljust(99)[:99]
        self.assertEqual(len(msg_99), 99)
        self.assertFalse(validate_outreach_message(msg_99, lead))

    # VAL-OUT-006: property address present
    def test_validate_rejects_messages_missing_property_address(self) -> None:
        """Messages that don't contain the lead's property address must be rejected."""
        lead = self._base_lead()
        msg_no_address = (
            "Dear Hernandez, we noticed you may have filed an insurance claim. "
            "As a licensed Florida public adjuster, Claim Remedy Adjusters helps "
            "property owners maximize their insurance settlements at no upfront cost. "
            "Please call us at (800) 555-0100 to schedule a free property inspection."
        )
        self.assertFalse(
            validate_outreach_message(msg_no_address, lead),
            "Messages missing the property address should fail validation",
        )

    def test_validate_accepts_messages_containing_property_address(self) -> None:
        """Messages that include the address should pass the address check."""
        lead = self._base_lead()
        self.assertTrue(validate_outreach_message(self._valid_message(), lead))

    # No placeholder tokens
    def test_validate_rejects_template_placeholder_messages(self) -> None:
        """Messages starting with TEMPLATE: prefix must be rejected."""
        lead = self._base_lead()
        template_msg = (
            "TEMPLATE: Dear Hernandez, our records indicate your property at "
            "3210 NW 7th Ave may have sustained hurricane damage. As a licensed "
            "Florida public adjuster, Claim Remedy Adjusters specializes in "
            "maximizing insurance settlements. Call us at (800) 555-0100."
        )
        self.assertFalse(
            validate_outreach_message(template_msg, lead),
            "Messages with TEMPLATE: prefix should fail validation",
        )

    def test_validate_rejects_none_and_empty_messages(self) -> None:
        """None and empty messages must be rejected."""
        lead = self._base_lead()
        self.assertFalse(validate_outreach_message("", lead))
        self.assertFalse(validate_outreach_message(None, lead))  # type: ignore[arg-type]


class CamelCaseCompatibilityTests(unittest.TestCase):
    """Integration tests verifying that camelCase runtime keys from leads.json work correctly.

    enrich_outreach.py passes camelCase rows directly from public/leads.json to
    build_outreach_prompt() and validate_outreach_message(). These tests verify
    that both functions handle the runtime data shape.
    """

    def _camelcase_lead(self) -> dict:
        """A realistic camelCase lead fixture matching public/leads.json runtime shape."""
        return {
            "id": "lead-abc123",
            "ownerName": "HERNANDEZ, MARIA",
            "propertyAddress": "3210 NW 7th Ave",
            "city": "Miami",
            "zip": "33127",
            "damageType": "Hurricane/Wind",
            "permitType": "Roof Replacement",
            "permitDate": "2026-03-01",
            "stormEvent": "Hurricane Helene (Sept 2025)",
            "score": 82,
            "status": "New",
        }

    # --- build_outreach_prompt: camelCase basic keys ---

    def test_prompt_uses_camelcase_property_address(self) -> None:
        """build_outreach_prompt reads propertyAddress from camelCase lead."""
        lead = self._camelcase_lead()
        prompt = build_outreach_prompt(lead)
        self.assertIn("3210 NW 7th Ave", prompt, "Prompt should include propertyAddress")

    def test_prompt_uses_camelcase_owner_name(self) -> None:
        """build_outreach_prompt reads ownerName from camelCase lead."""
        lead = self._camelcase_lead()
        prompt = build_outreach_prompt(lead)
        # _salutation_name("HERNANDEZ, MARIA") → "Hernandez"
        self.assertIn("Hernandez", prompt, "Prompt should include salutation from ownerName")

    def test_prompt_uses_camelcase_damage_type(self) -> None:
        """build_outreach_prompt reads damageType from camelCase lead."""
        lead = self._camelcase_lead()
        prompt = build_outreach_prompt(lead)
        self.assertIn("Hurricane/Wind", prompt, "Prompt should include damageType")

    def test_prompt_uses_camelcase_storm_event(self) -> None:
        """build_outreach_prompt reads stormEvent from camelCase lead."""
        lead = self._camelcase_lead()
        prompt = build_outreach_prompt(lead)
        self.assertIn("Hurricane Helene", prompt, "Prompt should include stormEvent")

    # --- build_outreach_prompt: camelCase enrichment signal keys ---

    def test_prompt_includes_fema_via_camelcase_key(self) -> None:
        """build_outreach_prompt picks up femaDeclarationNumber from camelCase lead."""
        lead = {**self._camelcase_lead(), "femaDeclarationNumber": "DR-4709-FL"}
        prompt = build_outreach_prompt(lead)
        self.assertTrue(
            "DR-4709-FL" in prompt or "FEMA" in prompt,
            "Prompt should reference FEMA declaration from camelCase key",
        )

    def test_prompt_includes_permit_status_via_camelcase_key(self) -> None:
        """build_outreach_prompt picks up permitStatus from camelCase lead."""
        lead = {**self._camelcase_lead(), "permitStatus": "Owner-Builder"}
        prompt = build_outreach_prompt(lead)
        self.assertIn("Owner-Builder", prompt, "Prompt should include permitStatus from camelCase key")

    def test_prompt_includes_underpaid_flag_via_camelcase_key(self) -> None:
        """build_outreach_prompt picks up underpaidFlag from camelCase lead."""
        lead = {**self._camelcase_lead(), "underpaidFlag": True}
        prompt = build_outreach_prompt(lead)
        underpayment_terms = ("underpaid", "underpayment", "under-paid")
        self.assertTrue(
            any(term in prompt.lower() for term in underpayment_terms),
            "Prompt should include underpayment context when underpaidFlag=True",
        )

    def test_prompt_includes_insurance_company_via_camelcase_key(self) -> None:
        """build_outreach_prompt picks up insuranceCompany from camelCase lead."""
        lead = {
            **self._camelcase_lead(),
            "insuranceCompany": "Citizens Property Insurance",
            "insurerRisk": "high",
        }
        prompt = build_outreach_prompt(lead)
        self.assertIn(
            "Citizens Property Insurance", prompt,
            "Prompt should include insuranceCompany from camelCase key",
        )

    def test_prompt_excludes_fema_when_camelcase_value_is_none(self) -> None:
        """build_outreach_prompt skips FEMA section when femaDeclarationNumber is None."""
        lead = {**self._camelcase_lead(), "femaDeclarationNumber": None}
        prompt = build_outreach_prompt(lead)
        self.assertNotIn("DR-", prompt, "No FEMA section expected when femaDeclarationNumber is None")

    def test_prompt_excludes_underpaid_when_camelcase_flag_is_false(self) -> None:
        """build_outreach_prompt skips underpayment when underpaidFlag is False."""
        lead = {**self._camelcase_lead(), "underpaidFlag": False}
        prompt = build_outreach_prompt(lead)
        self.assertFalse(
            any(term in prompt.lower() for term in ("underpaid", "underpayment")),
            "No underpayment context expected when underpaidFlag=False",
        )

    # --- validate_outreach_message: camelCase propertyAddress key ---

    def _valid_message(self, address: str = "3210 NW 7th Ave") -> str:
        return (
            f"Dear Hernandez, our records show your property at {address} may have "
            "sustained hurricane damage. As a licensed Florida public adjuster, "
            "Claim Remedy Adjusters specializes in maximizing insurance settlements. "
            "Please call us at (800) 555-0100 for a free inspection."
        )

    def test_validate_uses_camelcase_property_address(self) -> None:
        """validate_outreach_message reads propertyAddress from camelCase lead."""
        lead = {
            "propertyAddress": "3210 NW 7th Ave",
            "city": "Miami",
            "zip": "33127",
        }
        self.assertTrue(
            validate_outreach_message(self._valid_message(), lead),
            "Validation should pass when message contains propertyAddress from camelCase lead",
        )

    def test_validate_rejects_message_missing_camelcase_property_address(self) -> None:
        """validate_outreach_message rejects messages missing the propertyAddress."""
        lead = {
            "propertyAddress": "3210 NW 7th Ave",
            "city": "Miami",
            "zip": "33127",
        }
        msg_no_address = (
            "Dear Hernandez, we noticed you may have filed an insurance claim. "
            "As a licensed Florida public adjuster, Claim Remedy Adjusters helps "
            "property owners maximize their insurance settlements at no upfront cost. "
            "Please call us at (800) 555-0100 to schedule a free property inspection."
        )
        self.assertFalse(
            validate_outreach_message(msg_no_address, lead),
            "Validation should fail when message is missing the propertyAddress value",
        )

    def test_validate_with_both_address_forms_prefers_snake_case(self) -> None:
        """When lead has both 'address' and 'propertyAddress', address check uses 'address' first."""
        lead = {
            "address": "123 Main St",
            "propertyAddress": "456 Other Ave",
        }
        # Message contains snake_case value 'address' — should pass
        msg_with_snake = self._valid_message(address="123 Main St")
        self.assertTrue(
            validate_outreach_message(msg_with_snake, lead),
            "Validation should pass when message contains 'address' value (snake_case takes priority)",
        )

    def test_full_camelcase_fixture_produces_valid_prompt_and_passes_validation(self) -> None:
        """Full integration: camelCase lead → prompt → simulate message → validation passes."""
        lead = {
            **self._camelcase_lead(),
            "femaDeclarationNumber": "DR-4709-FL",
            "permitStatus": "Stalled",
            "underpaidFlag": True,
            "insuranceCompany": "Universal Property",
            "insurerRisk": "medium",
        }
        # Build prompt should not raise and should contain key signals
        prompt = build_outreach_prompt(lead)
        self.assertIn("3210 NW 7th Ave", prompt)
        self.assertIn("DR-4709-FL", prompt)
        self.assertIn("Stalled", prompt)
        self.assertIn("Universal Property", prompt)

        # Simulate a valid enriched message referencing propertyAddress
        simulated_message = (
            "Dear Hernandez, our records show your property at 3210 NW 7th Ave has a "
            "stalled permit and may be covered under FEMA declaration DR-4709-FL. "
            "Claim Remedy Adjusters can help you maximize your settlement with Universal "
            "Property. Call us at (800) 555-0100 for a free, no-obligation inspection."
        )
        self.assertTrue(
            validate_outreach_message(simulated_message, lead),
            "Simulated message should pass validation for a full camelCase fixture lead",
        )


if __name__ == "__main__":
    unittest.main()
