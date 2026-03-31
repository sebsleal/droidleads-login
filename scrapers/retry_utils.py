"""
Shared retry-with-backoff utilities for HTTP-based scrapers.

Provides a single retry_request() wrapper around requests.get that:
  - Retries up to 3 attempts on transient errors
  - Uses exponential backoff: 1s, 2s, 4s
  - Retries only on: 408, 429, 500, 502, 503, 504, ConnectionError
  - Does NOT retry on: 400, 401, 403, 404, or other client errors
"""

from __future__ import annotations

import time
import requests
from typing import Any


# HTTP status codes that warrant a retry (transient server-side or network issues)
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}

# Backoff delays in seconds between retry attempts
BACKOFF_DELAYS = (1.0, 2.0, 4.0)

# Maximum retry attempts
MAX_RETRIES = 3


def retry_request(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float | None = None,
    max_retries: int = MAX_RETRIES,
    backoff_delays: tuple[float, ...] = BACKOFF_DELAYS,
) -> requests.Response:
    """
    Issue an HTTP GET request with automatic retry and exponential backoff.

    Args:
        url:         The URL to request.
        params:      Query parameters (passed to requests.get).
        headers:     HTTP headers (passed to requests.get).
        timeout:     Request timeout in seconds.
        max_retries: Maximum number of retry attempts (default 3).
        backoff_delays: Sequence of delay seconds between attempts.
                       Must have at least max_retries-1 entries.

    Returns:
        A requests.Response object from the final (successful or non-retryable) attempt.

    Raises:
        requests.HTTPError: For non-retryable HTTP errors (4xx except 408/429).
        requests.ConnectionError: For non-retryable connection failures.
    """
    if len(backoff_delays) < max_retries:
        raise ValueError(
            f"backoff_delays must have at least {max_retries} entries, "
            f"got {len(backoff_delays)}"
        )

    last_exception: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=timeout,
            )

            # Retry on transient status codes
            if response.status_code in RETRYABLE_STATUS_CODES:
                if attempt < max_retries - 1:
                    delay = backoff_delays[attempt]
                    print(
                        f"[retry] {response.status_code} for {url} — "
                        f"retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(delay)
                    continue
                # Last attempt — let it propagate
                response.raise_for_status()

            # Non-retryable status: raise immediately
            response.raise_for_status()
            return response

        except requests.HTTPError as exc:
            # Client errors (400, 401, 403, 404, etc.) are not retryable
            status = exc.response.status_code if exc.response is not None else 0
            if status in RETRYABLE_STATUS_CODES:
                # Retryable but we might be out of attempts
                if attempt < max_retries - 1:
                    delay = backoff_delays[attempt]
                    print(
                        f"[retry] HTTP {status} for {url} — "
                        f"retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(delay)
                    continue
            # Non-retryable or exhausted — store and break
            last_exception = exc
            break

        except requests.ConnectionError as exc:
            last_exception = exc
            if attempt < max_retries - 1:
                delay = backoff_delays[attempt]
                print(
                    f"[retry] ConnectionError for {url} — "
                    f"retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(delay)
                continue
            # Exhausted retries
            break

        except requests.Timeout as exc:
            # Timeout is transient — retry with backoff
            last_exception = exc
            if attempt < max_retries - 1:
                delay = backoff_delays[attempt]
                print(
                    f"[retry] Timeout for {url} — "
                    f"retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(delay)
                continue
            break

        # All other requests.RequestException subclasses (e.g. TooManyRedirects,
        # URLRequired, InvalidURL, JSONDecodeError, MissingSchema, SSLError) are
        # permanent failures — do NOT retry; raise immediately.
        # The bare except here catches any RequestException not already handled above.
        except requests.RequestException as exc:
            last_exception = exc
            break

    # All retries exhausted — raise the last stored exception
    if last_exception is not None:
        raise last_exception

    # Should not reach here, but return last response if we somehow have one
    raise requests.RequestException(f"Unreachable — no response from {url}")
