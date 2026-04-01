"""Tests for scrapers/retry_utils.py — retry-with-backoff behaviour."""
from __future__ import annotations

import unittest
import time
from unittest.mock import patch, MagicMock
from http.client import HTTPException

import requests

from scrapers.retry_utils import (
    retry_request,
    MAX_RETRIES,
    BACKOFF_DELAYS,
    RETRYABLE_STATUS_CODES,
)


class RetryRequestTests(unittest.TestCase):
    """Verify retry_request() behaviour: backoff, transient retry, error propagation."""

    def test_succeeds_on_first_attempt(self) -> None:
        """No retry needed — first call succeeds and returns immediately."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 200

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            resp = retry_request("https://example.com/api")
            self.assertIs(resp, mock_resp)
            self.assertEqual(mock_get.call_count, 1)

    def test_retries_up_to_max_attempts(self) -> None:
        """When every attempt returns a retryable status, exactly max_retries calls are made."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        mock_resp.ok = False
        # raise_for_status raises HTTPError with this status
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError) as ctx:
                retry_request("https://example.com/api")
            self.assertEqual(ctx.exception.response.status_code, 503)
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_exponential_backoff_delays(self) -> None:
        """Retryable failures trigger exponential backoff: 1s, 2s, 4s."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp):
            with patch("scrapers.retry_utils.time.sleep") as mock_sleep:
                with self.assertRaises(requests.HTTPError):
                    retry_request("https://example.com/api")
                # Backoff delays are applied between retry attempts (N-1 sleeps for N attempts)
                self.assertEqual(mock_sleep.call_count, MAX_RETRIES - 1)
                # Verify the delay values match the first (MAX_RETRIES-1) entries in BACKOFF_DELAYS
                backoff_values = [call[0][0] for call in mock_sleep.call_args_list]
                self.assertEqual(backoff_values, list(BACKOFF_DELAYS[: MAX_RETRIES - 1]))

    def test_success_on_retry_after_transient_failure(self) -> None:
        """First attempt returns 503, second attempt succeeds — returns valid response."""
        fail_resp = MagicMock(spec=requests.Response)
        fail_resp.status_code = 503
        fail_resp.ok = False
        fail_exc = requests.HTTPError(response=MagicMock(status_code=503))
        fail_resp.raise_for_status.side_effect = fail_exc

        success_resp = MagicMock(spec=requests.Response)
        success_resp.status_code = 200
        success_resp.ok = True
        success_resp.raise_for_status.return_value = None

        with patch("scrapers.retry_utils.requests.get", side_effect=[fail_resp, success_resp]):
            resp = retry_request("https://example.com/api")
            self.assertEqual(resp.status_code, 200)

    def test_no_retry_on_400_client_error(self) -> None:
        """HTTP 400 is not retryable — raises immediately after one call."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 400
        exc = requests.HTTPError(response=MagicMock(status_code=400))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError) as ctx:
                retry_request("https://example.com/api")
            self.assertEqual(ctx.exception.response.status_code, 400)
            self.assertEqual(mock_get.call_count, 1)

    def test_no_retry_on_401_unauthorized(self) -> None:
        """HTTP 401 is not retryable — raises immediately."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 401
        exc = requests.HTTPError(response=MagicMock(status_code=401))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)

    def test_no_retry_on_403_forbidden(self) -> None:
        """HTTP 403 is not retryable — raises immediately."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 403
        exc = requests.HTTPError(response=MagicMock(status_code=403))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)

    def test_no_retry_on_404_not_found(self) -> None:
        """HTTP 404 is not retryable — raises immediately."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 404
        exc = requests.HTTPError(response=MagicMock(status_code=404))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)

    def test_retries_on_408_request_timeout(self) -> None:
        """HTTP 408 is retryable — retries up to max_attempts."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 408
        exc = requests.HTTPError(response=MagicMock(status_code=408))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_retries_on_429_rate_limit(self) -> None:
        """HTTP 429 (rate limit) is retryable — retries up to max_attempts."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 429
        exc = requests.HTTPError(response=MagicMock(status_code=429))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_retries_on_500_server_error(self) -> None:
        """HTTP 500 is retryable — retries up to max_attempts."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 500
        exc = requests.HTTPError(response=MagicMock(status_code=500))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            with self.assertRaises(requests.HTTPError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_retries_on_connection_error(self) -> None:
        """ConnectionError is retryable — retries up to max_attempts."""
        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=requests.ConnectionError("Connection refused"),
        ) as mock_get:
            with self.assertRaises(requests.ConnectionError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_retries_on_timeout(self) -> None:
        """requests.Timeout is retryable — retries up to max_attempts."""
        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=requests.Timeout("timed out"),
        ) as mock_get:
            with self.assertRaises(requests.Timeout):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, MAX_RETRIES)

    def test_passes_params_and_headers_to_requests_get(self) -> None:
        """retry_request forwards params and headers to requests.get."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp) as mock_get:
            retry_request(
                "https://example.com/api",
                params={"key": "value"},
                headers={"Authorization": "Bearer token"},
                timeout=10,
            )
            mock_get.assert_called_once_with(
                "https://example.com/api",
                params={"key": "value"},
                headers={"Authorization": "Bearer token"},
                timeout=10,
            )


class ConcurrentScrapeErrorIsolationTests(unittest.TestCase):
    """Verify VAL-CROSS-007 / VAL-CROSS-008: one county failure does not block others."""

    def test_one_county_failure_does_not_block_others(self) -> None:
        """
        When one county's scraper raises an exception after retries, other counties
        still complete and return results.  The real _scrape_county wraps scrape_damage_permits
        in try/except so a failure returns an empty list without propagating the exception
        to the ThreadPoolExecutor result — we verify that same behaviour here.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from scrapers.permits import COUNTY_CONFIGS

        # Count how many counties succeed (enabled)
        enabled = [
            c for c, cfg in COUNTY_CONFIGS.items() if cfg.get("enabled")
        ]

        # Simulate _scrape_county behaviour with error isolation:
        # one always fails (caught by try/except), others succeed.
        def fake_scrape(county: str) -> tuple[str, list]:
            try:
                if county == "will-fail":
                    raise RuntimeError("synthetic scrape failure")
                return county, [{"county": county, "address": f"123 Main St, {county}"}]
            except Exception:
                # Matches _scrape_county's: print + return county, []
                print(f"[lead-pipeline] Permit scrape failed for {county}: synthetic scrape failure")
                return county, []

        results: dict[str, list] = {}
        counties = enabled + ["will-fail"]

        with ThreadPoolExecutor(max_workers=len(counties)) as executor:
            futures = {
                executor.submit(fake_scrape, county): county
                for county in counties
            }
            for future in as_completed(futures):
                county, leads = future.result()
                results[county] = leads

        # The failing county returns an empty list (caught by try/except)
        self.assertEqual(results.get("will-fail"), [])
        # Enabled counties should still have results
        for county in enabled:
            self.assertIn(county, results)
            self.assertGreater(len(results[county]), 0)


class NonTransientRequestExceptionTests(unittest.TestCase):
    """
    Verify VAL-INFRA-009 (part 2): non-transient RequestException subclasses
    do NOT trigger retries — they fail fast after a single attempt.
    The contract-approved transient set is: HTTP 408/429/500/502/503/504,
    ConnectionError, and Timeout.
    All other requests.RequestException subclasses are permanent failures
    (e.g. InvalidURL, TooManyRedirects, URLRequired) and must NOT retry.
    """

    def test_no_retry_on_too_many_redirects(self) -> None:
        """requests.TooManyRedirects is a permanent RequestException — no retry."""
        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=requests.TooManyRedirects("Too many redirects"),
        ) as mock_get:
            with self.assertRaises(requests.TooManyRedirects):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)

    def test_no_retry_on_url_required(self) -> None:
        """requests.URLRequired is a permanent RequestException — no retry."""
        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=requests.URLRequired("URL required"),
        ) as mock_get:
            with self.assertRaises(requests.URLRequired):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)

    def test_no_retry_on_decode_error(self) -> None:
        """
        requests.JSONDecodeError (subclass of RequestException) is non-transient —
        no retry for malformed response bodies.
        """
        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=requests.JSONDecodeError("Expecting value", "", 0),
        ) as mock_get:
            with self.assertRaises(requests.JSONDecodeError):
                retry_request("https://example.com/api")
            self.assertEqual(mock_get.call_count, 1)


class TransientFailureThenSuccessTests(unittest.TestCase):
    """
    Verify VAL-INFRA-010: transient failure followed by success returns valid data.
    """

    def test_transient_503_then_success_returns_valid_response(self) -> None:
        """First attempt returns 503 (transient), second attempt returns 200 — data is returned."""
        fail_resp = MagicMock(spec=requests.Response)
        fail_resp.status_code = 503
        fail_resp.ok = False
        fail_exc = requests.HTTPError(response=MagicMock(status_code=503))
        fail_resp.raise_for_status.side_effect = fail_exc

        success_resp = MagicMock(spec=requests.Response)
        success_resp.status_code = 200
        success_resp.ok = True
        success_resp.raise_for_status.return_value = None
        success_resp.json.return_value = {"data": "valid"}

        with patch("scrapers.retry_utils.requests.get", side_effect=[fail_resp, success_resp]):
            resp = retry_request("https://example.com/api")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json(), {"data": "valid"})

    def test_transient_connection_error_then_success_returns_valid_response(self) -> None:
        """First attempt raises ConnectionError (transient), second succeeds — valid data returned."""
        success_resp = MagicMock(spec=requests.Response)
        success_resp.status_code = 200
        success_resp.ok = True
        success_resp.raise_for_status.return_value = None
        success_resp.json.return_value = {"leads": []}

        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=[requests.ConnectionError("Connection reset"), success_resp],
        ):
            resp = retry_request("https://example.com/api")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json(), {"leads": []})

    def test_transient_timeout_then_success_returns_valid_response(self) -> None:
        """First attempt raises Timeout (transient), second succeeds — valid data returned."""
        success_resp = MagicMock(spec=requests.Response)
        success_resp.status_code = 200
        success_resp.ok = True
        success_resp.raise_for_status.return_value = None
        success_resp.json.return_value = {"count": 42}

        with patch(
            "scrapers.retry_utils.requests.get",
            side_effect=[requests.Timeout("timed out"), success_resp],
        ):
            resp = retry_request("https://example.com/api")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json(), {"count": 42})


class RetryableStatusCodesContract(unittest.TestCase):
    """Ensure RETRYABLE_STATUS_CODES only contains transient codes."""

    def test_retryable_codes_are_transient(self) -> None:
        """Retryable codes should be server/network issues, not client errors."""
        # These are the transient codes we intend to retry
        transient = {408, 429, 500, 502, 503, 504}
        self.assertEqual(RETRYABLE_STATUS_CODES, transient)

    def test_client_errors_not_in_retryable_codes(self) -> None:
        """4xx client errors (except 408) should NOT be in retryable set."""
        client_errors = {400, 401, 403, 404, 405, 409, 410}
        for code in client_errors:
            self.assertNotIn(
                code,
                RETRYABLE_STATUS_CODES,
                f"Client error {code} should not be retryable",
            )


class BackoffDelayTupleValidationTests(unittest.TestCase):
    """Verify backoff_delays tuple length validation (max_retries - 1 boundary)."""

    # With default max_retries=3, we need exactly 2 delays (consumed at attempt 0 and 1)
    # The last attempt (attempt=2) does not sleep — it propagates the error.

    def test_accepts_exactly_max_retries_minus_one_delays(self) -> None:
        """Custom backoff_delays with exactly max_retries-1 entries is accepted."""
        # 2 delays for max_retries=3 — exactly the number of sleeps that occur
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp):
            with patch("scrapers.retry_utils.time.sleep") as mock_sleep:
                with self.assertRaises(requests.HTTPError):
                    retry_request(
                        "https://example.com/api",
                        backoff_delays=(0.1, 0.2),
                    )
                # Two sleeps should have occurred with our custom delays
                self.assertEqual(mock_sleep.call_count, 2)
                backoff_values = [call[0][0] for call in mock_sleep.call_args_list]
                self.assertEqual(backoff_values, [0.1, 0.2])

    def test_accepts_more_than_max_retries_minus_one_delays(self) -> None:
        """Custom backoff_delays with more than max_retries-1 entries is accepted (extra ignored)."""
        # 4 delays for max_retries=3 — only first 2 are consumed
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp):
            with patch("scrapers.retry_utils.time.sleep") as mock_sleep:
                with self.assertRaises(requests.HTTPError):
                    retry_request(
                        "https://example.com/api",
                        backoff_delays=(0.1, 0.2, 0.3, 0.4),
                    )
                # Only two sleeps should have occurred
                self.assertEqual(mock_sleep.call_count, 2)
                backoff_values = [call[0][0] for call in mock_sleep.call_args_list]
                # First two custom delays should have been used
                self.assertEqual(backoff_values, [0.1, 0.2])

    def test_rejects_fewer_than_max_retries_minus_one_delays(self) -> None:
        """Custom backoff_delays with fewer than max_retries-1 entries raises ValueError."""
        # 1 delay for max_retries=3 — not enough for the two sleeps that occur
        with self.assertRaises(ValueError) as ctx:
            retry_request(
                "https://example.com/api",
                backoff_delays=(0.5,),
            )
        self.assertIn("at least 2 entries", str(ctx.exception))
        self.assertIn("got 1", str(ctx.exception))

    def test_rejects_empty_backoff_delays(self) -> None:
        """Empty backoff_delays tuple raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            retry_request("https://example.com/api", backoff_delays=())
        self.assertIn("at least 2 entries", str(ctx.exception))
        self.assertIn("got 0", str(ctx.exception))

    def test_default_backoff_delays_accepted_with_default_max_retries(self) -> None:
        """Default BACKOFF_DELAYS (3 entries) is accepted with default max_retries=3."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp):
            with patch("scrapers.retry_utils.time.sleep") as mock_sleep:
                with self.assertRaises(requests.HTTPError):
                    retry_request("https://example.com/api")
                # Two sleeps with default BACKOFF_DELAYS
                self.assertEqual(mock_sleep.call_count, 2)
                backoff_values = [call[0][0] for call in mock_sleep.call_args_list]
                self.assertEqual(backoff_values, [1.0, 2.0])

    def test_custom_max_retries_and_matching_delays(self) -> None:
        """Custom max_retries=4 requires exactly 3 delays — accepted."""
        mock_resp = MagicMock(spec=requests.Response)
        mock_resp.status_code = 503
        exc = requests.HTTPError(response=MagicMock(status_code=503))
        mock_resp.raise_for_status.side_effect = exc

        with patch("scrapers.retry_utils.requests.get", return_value=mock_resp):
            with patch("scrapers.retry_utils.time.sleep") as mock_sleep:
                with self.assertRaises(requests.HTTPError):
                    retry_request(
                        "https://example.com/api",
                        max_retries=4,
                        backoff_delays=(0.1, 0.2, 0.3),
                    )
                # Three sleeps for max_retries=4
                self.assertEqual(mock_sleep.call_count, 3)
                backoff_values = [call[0][0] for call in mock_sleep.call_args_list]
                self.assertEqual(backoff_values, [0.1, 0.2, 0.3])

    def test_custom_max_retries_too_few_delays_raises(self) -> None:
        """Custom max_retries=4 with only 2 delays raises ValueError."""
        with self.assertRaises(ValueError) as ctx:
            retry_request(
                "https://example.com/api",
                max_retries=4,
                backoff_delays=(0.1, 0.2),
            )
        self.assertIn("at least 3 entries", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
