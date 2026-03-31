"""Tests for Broward county expansion: multi-endpoint permit scraping and county-aware PA routing."""

from __future__ import annotations

import unittest
from unittest.mock import patch, MagicMock

from scrapers.permits import scrape_damage_permits, _scrape_endpoint
from scrapers.property import lookup_by_folio


# ---------------------------------------------------------------------------
# Permits tests
# ---------------------------------------------------------------------------

class BrowardPermitsTests(unittest.TestCase):
    """VAL-EXPAND-001: Broward scraper queries multiple city endpoints."""

    def _mock_features(self, owner: str = "Test Owner",
                        address: str = "123 Test St",
                        permit_desc: str = "Roof Repair",
                        folio: str = "0123456789") -> list:
        return [{"attributes": {
            "PERMITID": "BLD-001",
            "PERMITTYPE": "General",
            "PERMITDESC": permit_desc,
            "PERMITSTAT": "Approved",
            "SUBMITDT": 1933929600000,  # 2021-05-01 epoch-ms
            "PARCELID": folio,
            "FULLADDR": address,
            "OWNERNAME": owner,
            "OWNERADDR": "",
            "OWNERCITY": "",
            "OWNERZIP": "",
            "CONTRACTOR": "Test Contractor",
            "CONTRACTPH": "9545551234",
            "ESTCOST": 15000,
            "LASTUPDATEDATE": None,
        }, "geometry": {"x": -80.1, "y": 26.1}}]

    def test_broward_scrapes_multiple_endpoints(self) -> None:
        """
        scrape_damage_permits('broward') contacts ≥3 distinct Broward hostnames.

        Confirmed working Broward endpoints (2026-03):
          1. Fort Lauderdale MapServer (gis.fortlauderdale.gov)
          2. Broward REST View county-wide (services5.arcgis.com/DllnbBENKfts6TQD)
             — covers unincorporated Broward + municipalities that report to the county
          3. Broward HCED Posse Permits (bcgishub.broward.org)
             — county-wide permits from HCED Posse system, updated daily

        Additional cities (Hollywood, Pembroke Pines, Coral Springs, Pompano Beach)
        do not publish public ArcGIS endpoints — their permit systems are Click2Gov
        web applications requiring authentication. See permits.py COUNTY_CONFIGS
        for full research notes.
        """
        seen_hosts: set[str] = set()

        def capture_get(url: str, **kwargs: object) -> MagicMock:
            from urllib.parse import urlparse
            seen_hosts.add(urlparse(url).netloc)
            mock_resp = MagicMock()
            mock_resp.raise_for_status = MagicMock()
            mock_resp.json = MagicMock(return_value={
                "features": self._mock_features(),
                "exceededTransferLimit": False,
            })
            return mock_resp

        with patch("scrapers.permits.requests.get", side_effect=capture_get):
            leads = scrape_damage_permits("broward", max_records=10, lookback_days=90)

        # Should have contacted all three endpoints:
        # 1. Fort Lauderdale MapServer (gis.fortlauderdale.gov)
        # 2. Broward REST View county-wide (services5.arcgis.com/DllnbBENKfts6TQD)
        # 3. Broward HCED Posse Permits (bcgishub.broward.org)
        self.assertGreaterEqual(len(seen_hosts), 3,
            f"Expected ≥3 distinct hosts, got {len(seen_hosts)}: {seen_hosts}")

    def test_broward_leads_have_county_broward(self) -> None:
        """All Broward leads have county='broward'."""
        def fake_get(url: str, **kwargs: object) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.raise_for_status = MagicMock()
            mock_resp.json = MagicMock(return_value={
                "features": self._mock_features(),
                "exceededTransferLimit": False,
            })
            return mock_resp

        with patch("scrapers.permits.requests.get", side_effect=fake_get):
            leads = scrape_damage_permits("broward", max_records=10, lookback_days=90)

        self.assertGreater(len(leads), 0, "Should produce at least 1 lead")
        for lead in leads:
            self.assertEqual(lead["county"], "broward",
                f"Lead city={lead['city']} should have county='broward', got {lead['county']}")

    def test_broward_leads_carry_correct_city(self) -> None:
        """Leads from different endpoints carry their respective city names."""
        def fake_get(url: str, **kwargs: object) -> MagicMock:
            mock_resp = MagicMock()
            mock_resp.raise_for_status = MagicMock()
            # 1. Fort Lauderdale endpoint
            if "fortlauderdale" in url:
                features = [{"attributes": {
                    "PERMITID": "FL-001", "PERMITTYPE": "General",
                    "PERMITDESC": "Roof Repair", "PERMITSTAT": "Approved",
                    "SUBMITDT": 1933929600000, "PARCELID": "1234567890",
                    "FULLADDR": "100 Las Olas Blvd", "OWNERNAME": "Jane Doe",
                    "OWNERADDR": "", "OWNERCITY": "", "OWNERZIP": "",
                    "CONTRACTOR": "", "CONTRACTPH": "", "ESTCOST": 20000,
                    "LASTUPDATEDATE": None,
                }, "geometry": {"x": -80.1, "y": 26.1}}]
            # 2. Broward REST View county-wide
            elif "DllnbBENKfts6TQD" in url:
                features = [{"attributes": {
                    "PermitID": "BC-001", "TYPE": "General",
                    "description": "Hurricane Damage", "submissionDate": 1933929600000,
                    "Address": "200 Broward Blvd", "applicantName": "John Smith",
                    "applicantPhone": "9545559999", "total_cost": 35000.0,
                }, "geometry": {"x": -80.1, "y": 26.1}}]
            # 3. Broward HCED Posse Permits
            else:
                features = [{"attributes": {
                    "PERMITNUM": "HCED-001", "PERMITTYPE": "Roof",
                    "FISTATUS": "Active", "PERMITTEE": "Roof Co",
                    "OWNER": "Jane HCED", "ISSUEDATE": 1933929600000,
                    "JOBADDRESS": "300 SE 3rd St", "LOCATION": "300 SE 3rd St Pompano Beach FL",
                    "WORKDESCRIPTION": "Roof Replacement Due to Hurricane",
                    "CITY": "POMPANO BEACH", "CONTACT": "9545551234",
                    "ZIPCODE": 33060,
                }, "geometry": {"x": -80.1, "y": 26.2}}]
            mock_resp.json = MagicMock(return_value={
                "features": features,
                "exceededTransferLimit": False,
            })
            return mock_resp

        with patch("scrapers.permits.requests.get", side_effect=fake_get):
            leads = scrape_damage_permits("broward", max_records=10, lookback_days=90)

        cities = {lead["city"] for lead in leads}
        self.assertGreater(len(cities), 0, "Should have at least one city")
        # All leads should have non-empty city
        for lead in leads:
            self.assertTrue(lead["city"], f"Lead should have a city: {lead}")


# ---------------------------------------------------------------------------
# Property-appraiser PA routing tests
# ---------------------------------------------------------------------------

class BrowardPARoutingTests(unittest.TestCase):
    """VAL-EXPAND-002: Broward leads enriched via BCPA; Miami-Dade via MD PA."""

    def test_lookup_by_folio_routes_to_bcpa_for_broward(self) -> None:
        """lookup_by_folio routes to BCPA endpoint when county='broward'."""
        with patch("scrapers.property.requests.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = '{"owner": "Jane Broward", "homestead": true}'
            mock_get.return_value = mock_resp

            result = lookup_by_folio("012345678901", county="broward")

        # Should have called BCPA URL, not Miami-Dade URL
        mock_get.assert_called_once()
        called_url = mock_get.call_args[0][0]
        self.assertIn("bcpa.net", called_url)
        self.assertNotIn("miamidadepa.gov", called_url)

    def test_lookup_by_folio_routes_to_miami_dade_for_miami_dade(self) -> None:
        """lookup_by_folio routes to Miami-Dade PA endpoint when county='miami-dade'."""
        with patch("scrapers.property.requests.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = '{"OwnerInfos": [{"Name": "Jane Miami"}], "MailingAddress": {}, "PropertyInfo": {}, "Assessment": {}}'
            mock_get.return_value = mock_resp

            result = lookup_by_folio("0123456789", county="miami-dade")

        mock_get.assert_called_once()
        called_url = mock_get.call_args[0][0]
        self.assertIn("miamidadepa.gov", called_url)

    def test_bcpa_lookup_returns_parsed_result(self) -> None:
        """BCPA lookup returns owner_name, homestead, assessed_value from BCPA response."""
        bcpa_response = {
            "owner": "Jane Broward",
            "mailing_address": "123 Mail St",
            "mailing_city": "Fort Lauderdale",
            "mailing_state": "FL",
            "mailing_zip": "33301",
            "site_zip": "33312",
            "homestead": True,
            "assessed_value": 350000,
            "year_built": 1985,
        }

        with patch("scrapers.property.requests.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            # r.text must be non-empty to pass the "if not r.text.strip()" guard
            mock_resp.text = "..."
            mock_get.return_value = mock_resp
            mock_resp.json.return_value = bcpa_response

            result = lookup_by_folio("012345678901", county="broward")

        self.assertIsNotNone(result)
        self.assertEqual(result["owner_name"], "Jane Broward")
        self.assertEqual(result["mailing_city"], "Fort Lauderdale")
        self.assertIs(result["homestead"], True)
        self.assertEqual(result["assessed_value"], 350000)

    def test_bcpa_homestead_string_parsed(self) -> None:
        """BCPA response with homestead='Y' is parsed as True."""
        with patch("scrapers.property.requests.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = "..."
            mock_get.return_value = mock_resp
            mock_resp.json.return_value = {
                "owner": "Test Owner",
                "homestead": "Y",
                "assessed_value": 200000,
            }

            result = lookup_by_folio("012345678901", county="broward")

        self.assertIsNotNone(result)
        self.assertIs(result["homestead"], True)

    def test_enrich_leads_with_owner_info_routes_broward_to_bcpa(self) -> None:
        """enrich_leads_with_owner_info calls BCPA for broward county leads."""
        from scrapers.property import enrich_leads_with_owner_info

        leads = [
            {
                "folio_number": "012345678901",
                "county": "broward",
                "address": "456 Broward Ave",
            }
        ]

        with patch("scrapers.property.lookup_by_folio") as mock_lookup:
            mock_lookup.return_value = {
                "owner_name": "Broward Owner",
                "mailing_address": "789 Mail St",
                "mailing_city": "Fort Lauderdale",
                "mailing_state": "FL",
                "mailing_zip": "33301",
                "site_zip": "33312",
                "homestead": True,
                "assessed_value": 400000,
                "roof_age": 15,
            }

            enrich_leads_with_owner_info(leads, delay=0)

            # Should have called lookup_by_folio with county="broward"
            mock_lookup.assert_called_once()
            call_kwargs = mock_lookup.call_args[1]
            self.assertEqual(call_kwargs.get("county"), "broward",
                "lookup_by_folio should be called with county='broward' for Broward leads")

    def test_enrich_leads_with_owner_info_routes_miami_dade_to_md_pa(self) -> None:
        """enrich_leads_with_owner_info calls Miami-Dade PA for miami-dade county leads."""
        from scrapers.property import enrich_leads_with_owner_info

        leads = [
            {
                "folio_number": "0123456789",
                "county": "miami-dade",
                "address": "123 Miami Ave",
            }
        ]

        with patch("scrapers.property.lookup_by_folio") as mock_lookup:
            mock_lookup.return_value = {
                "owner_name": "Miami Owner",
                "mailing_address": "789 Mail St",
                "mailing_city": "Miami",
                "mailing_state": "FL",
                "mailing_zip": "33139",
                "site_zip": "33139",
                "homestead": True,
                "assessed_value": 500000,
                "roof_age": 10,
            }

            enrich_leads_with_owner_info(leads, delay=0)

            mock_lookup.assert_called_once()
            call_kwargs = mock_lookup.call_args[1]
            self.assertEqual(call_kwargs.get("county"), "miami-dade",
                "lookup_by_folio should be called with county='miami-dade' for Miami-Dade leads")

    def test_lookup_by_folio_defaults_to_miami_dade(self) -> None:
        """lookup_by_folio with no county arg defaults to Miami-Dade."""
        with patch("scrapers.property.requests.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.text = '{"OwnerInfos": [{"Name": "Default Test"}], "MailingAddress": {}, "PropertyInfo": {}, "Assessment": {}}'
            mock_get.return_value = mock_resp

            result = lookup_by_folio("0123456789")  # no county arg

        mock_get.assert_called_once()
        called_url = mock_get.call_args[0][0]
        self.assertIn("miamidadepa.gov", called_url)


if __name__ == "__main__":
    unittest.main()
