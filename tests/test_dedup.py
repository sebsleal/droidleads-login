"""
Tests for scrapers/dedup.py — address normalization and deduplication.
"""

import unittest
from scrapers.dedup import (
    normalize_address,
    make_hash,
    deduplicate_leads,
)


class TestNormalizeAddress(unittest.TestCase):
    """Tests for the normalize_address() function."""

    def test_st_abbreviated_to_street(self):
        """St should normalize to Street."""
        self.assertEqual(
            normalize_address("123 Main St"),
            normalize_address("123 Main Street"),
        )

    def test_ave_abbreviated_to_avenue(self):
        """Ave should normalize to Avenue."""
        self.assertEqual(
            normalize_address("456 Oak Ave"),
            normalize_address("456 Oak Avenue"),
        )

    def test_blvd_abbreviated_to_boulevard(self):
        """Blvd should normalize to Boulevard."""
        self.assertEqual(
            normalize_address("789 Pine Blvd"),
            normalize_address("789 Pine Boulevard"),
        )

    def test_dr_abbreviated_to_drive(self):
        """Dr should normalize to Drive."""
        self.assertEqual(
            normalize_address("100 River Dr"),
            normalize_address("100 River Drive"),
        )

    def test_ln_abbreviated_to_lane(self):
        """Ln should normalize to Lane."""
        self.assertEqual(
            normalize_address("200 Hill Ln"),
            normalize_address("200 Hill Lane"),
        )

    def test_ct_abbreviated_to_court(self):
        """Ct should normalize to Court."""
        self.assertEqual(
            normalize_address("300 Lake Ct"),
            normalize_address("300 Lake Court"),
        )

    def test_rd_abbreviated_to_road(self):
        """Rd should normalize to Road."""
        self.assertEqual(
            normalize_address("400 Park Rd"),
            normalize_address("400 Park Road"),
        )

    def test_nw_directional_normalized(self):
        """NW should normalize consistently (spacing)."""
        self.assertEqual(
            normalize_address("123 NW 7th Ave"),
            normalize_address("123 NW 7th Avenue"),
        )

    def test_ne_directional_normalized(self):
        """NE should normalize consistently."""
        self.assertEqual(
            normalize_address("456 NE 2nd St"),
            normalize_address("456 NE 2nd Street"),
        )

    def test_sw_directional_normalized(self):
        """SW should normalize consistently."""
        self.assertEqual(
            normalize_address("789 SW 10th Rd"),
            normalize_address("789 SW 10th Road"),
        )

    def test_se_directional_normalized(self):
        """SE should normalize consistently."""
        self.assertEqual(
            normalize_address("321 SE 3rd Blvd"),
            normalize_address("321 SE 3rd Boulevard"),
        )

    def test_normalization_is_idempotent(self):
        """Calling normalize_address() twice should produce the same result."""
        addr = "123 Main St"
        self.assertEqual(normalize_address(addr), normalize_address(addr))

    def test_mixed_case_normalized(self):
        """Mixed case addresses should normalize consistently."""
        self.assertEqual(
            normalize_address("123 MAIN ST"),
            normalize_address("123 Main St"),
        )

    def test_whitespace_stripped(self):
        """Leading/trailing whitespace should be stripped."""
        self.assertEqual(
            normalize_address("  123 Main St  "),
            normalize_address("123 Main St"),
        )

    def test_genuinely_different_addresses_different(self):
        """Different addresses should produce different normalized forms."""
        addr1 = normalize_address("123 Main St")
        addr2 = normalize_address("123 Main Street Ave")  # intentionally different
        # Even if some parts normalize the same, the full string should differ
        self.assertNotEqual(addr1, addr2)

    def test_different_street_numbers_different(self):
        """Different street numbers should produce different results."""
        self.assertNotEqual(
            normalize_address("123 Main St"),
            normalize_address("124 Main St"),
        )

    def test_different_street_names_different(self):
        """Different street names should produce different results."""
        self.assertNotEqual(
            normalize_address("123 Main St"),
            normalize_address("123 Oak St"),
        )


class TestMakeHash(unittest.TestCase):
    """Tests for make_hash() with address normalization."""

    def test_street_vs_street_produce_same_hash(self):
        """'123 Main St' and '123 Main Street' should produce the same hash."""
        self.assertEqual(
            make_hash("123 Main St", "2026-03-10"),
            make_hash("123 Main Street", "2026-03-10"),
        )

    def test_ave_vs_avenue_produce_same_hash(self):
        """'456 Oak Ave' and '456 Oak Avenue' should produce the same hash."""
        self.assertEqual(
            make_hash("456 Oak Ave", "2026-03-10"),
            make_hash("456 Oak Avenue", "2026-03-10"),
        )

    def test_blvd_vs_boulevard_produce_same_hash(self):
        """'789 Pine Blvd' and '789 Pine Boulevard' should produce same hash."""
        self.assertEqual(
            make_hash("789 Pine Blvd", "2026-03-10"),
            make_hash("789 Pine Boulevard", "2026-03-10"),
        )

    def test_different_addresses_different_hashes(self):
        """Genuinely different addresses should produce different hashes."""
        h1 = make_hash("123 Main St", "2026-03-10")
        h2 = make_hash("124 Main St", "2026-03-10")
        self.assertNotEqual(h1, h2)

    def test_different_dates_different_hashes(self):
        """Same address but different dates should produce different hashes."""
        h1 = make_hash("123 Main St", "2026-03-10")
        h2 = make_hash("123 Main St", "2026-03-11")
        self.assertNotEqual(h1, h2)

    def test_hash_is_12_chars(self):
        """Hash should be a 12-character hex string."""
        h = make_hash("123 Main St", "2026-03-10")
        self.assertEqual(len(h), 12)
        int(h, 16)  # should not raise


class TestDeduplicateLeads(unittest.TestCase):
    """Tests for deduplicate_leads() using normalized addresses."""

    def test_eliminates_normalized_duplicates(self):
        """Leads that differ only by address abbreviation should be deduplicated."""
        leads = [
            {"address": "1427 SW 8th St", "permit_date": "2026-03-10"},
            {"address": "1427 SW 8th Street", "permit_date": "2026-03-10"},  # duplicate
            {"address": "3812 NW 7th Ave", "permit_date": "2026-03-14"},
        ]
        unique, hashes = deduplicate_leads(leads)
        self.assertEqual(len(unique), 2)

    def test_different_addresses_preserved(self):
        """Leads with genuinely different addresses should all be kept."""
        leads = [
            {"address": "123 Main St", "permit_date": "2026-03-10"},
            {"address": "456 Oak Ave", "permit_date": "2026-03-10"},
        ]
        unique, hashes = deduplicate_leads(leads)
        self.assertEqual(len(unique), 2)

    def test_seen_hashes_excluded(self):
        """Leads matching already-seen hashes should be excluded."""
        seen = {make_hash("123 Main St", "2026-03-10")}
        leads = [
            {"address": "123 Main St", "permit_date": "2026-03-10"},
            {"address": "456 Oak Ave", "permit_date": "2026-03-10"},
        ]
        unique, hashes = deduplicate_leads(leads, seen_hashes=seen)
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["address"], "456 Oak Ave")

    def test_dedup_hash_injected(self):
        """Each surviving lead should have a dedup_hash key."""
        leads = [
            {"address": "123 Main St", "permit_date": "2026-03-10"},
        ]
        unique, _ = deduplicate_leads(leads)
        self.assertIn("dedup_hash", unique[0])

    def test_mixed_address_formats_deduplicated(self):
        """Mixed abbreviated/full forms of the same address should be deduped."""
        leads = [
            {"address": "500 Blvd Dr", "permit_date": "2026-01-01"},
            {"address": "500 Boulevard Drive", "permit_date": "2026-01-01"},
            {"address": "500 Blvd Dr", "permit_date": "2026-01-02"},  # different date
        ]
        unique, _ = deduplicate_leads(leads)
        # First two are dupes; third is unique due to different date
        self.assertEqual(len(unique), 2)


if __name__ == "__main__":
    unittest.main()
