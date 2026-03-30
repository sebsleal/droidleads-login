---
name: python-backend
description: Implements Python pipeline, scraper, enrichment, and scoring features with TDD
---

# Python Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving Python code: scrapers, pipeline logic, enrichment, scoring, database schema, outreach generation, dedup, caching, retry logic, concurrency.

## Required Skills

None — Python backend features use CLI-based testing and verification.

## Work Procedure

1. **Read the feature description** thoroughly. Understand preconditions, expected behavior, and verification steps.

2. **Read existing code** in the files you'll modify. Understand current patterns, imports, and conventions:
   - Scrapers use `requests` for HTTP, return lists of dicts
   - Pipeline uses snake_case keys internally
   - Tests are in `tests/` using `unittest.TestCase`
   - Enrichment functions take lead lists and return/mutate them in place

3. **Write failing tests first (RED)**:
   - Add test cases to existing test files in `tests/` or create new ones following `test_*.py` naming
   - Use `unittest.TestCase` — this project does NOT use pytest
   - Use `unittest.mock.patch` for mocking HTTP calls and external dependencies
   - Run: `python3 -m unittest discover -s tests -p 'test_*.py' -v`
   - Confirm new tests FAIL (they should, since implementation doesn't exist yet)

4. **Implement the feature (GREEN)**:
   - Follow existing code patterns and style
   - Use existing imports and libraries — don't add new dependencies unless absolutely necessary
   - For scraper changes: preserve rate limiting delays, error handling patterns
   - For scoring changes: preserve `_score_with_breakdown` return format (score + breakdown dict)
   - For DB changes: add SQL migration files in `db/migrations/` following existing numbering

5. **Run all tests and compile check**:
   - `python3 -m unittest discover -s tests -p 'test_*.py' -v` — ALL tests must pass
   - `python3 -m compileall company_data pipeline enrichment db scripts run_scraper.py generate_leads.py enrich_leads.py` — no compile errors

6. **Manual verification**:
   - For scoring changes: run a quick scoring test with a synthetic lead and print the breakdown
   - For scraper changes: if safe, do a dry run with a single API call to verify the endpoint works
   - For pipeline changes: verify the function signature and default parameters match expectations

7. **Commit** with a descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Fixed PA enrichment setdefault bug: replaced lead.setdefault() with None-aware assignment for homestead, assessed_value, owner_mailing_address, zip, and roof_age. Added 4 test cases covering None-overwrite, existing-value-preservation, missing-key, and empty-folio-skip. All 13 tests pass, compileall clean.",
  "whatWasImplemented": "Changed scrapers/property.py enrich_leads_with_owner_info() to use `if lead.get(key) is None: lead[key] = value` instead of `lead.setdefault(key, value)` for 5 PA-enriched fields. This ensures None values from canonicalization are overwritten by real PA data while preserving existing non-None values.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {"command": "python3 -m unittest discover -s tests -p 'test_*.py' -v", "exitCode": 0, "observation": "13 tests, all passing including 4 new PA enrichment tests"},
      {"command": "python3 -m compileall company_data pipeline enrichment db scripts run_scraper.py generate_leads.py enrich_leads.py", "exitCode": 0, "observation": "All modules compiled successfully"}
    ],
    "interactiveChecks": [
      {"action": "Ran quick test: created lead with homestead=None, mocked PA to return True, verified lead['homestead'] is True after enrichment", "observed": "Field correctly overwritten from None to True"}
    ]
  },
  "tests": {
    "added": [
      {"file": "tests/test_pa_enrichment.py", "cases": [
        {"name": "test_overwrites_none_homestead", "verifies": "PA data overwrites None values"},
        {"name": "test_overwrites_none_assessed_value", "verifies": "Assessed value overwritten from None"},
        {"name": "test_preserves_existing_values", "verifies": "Non-None values not overwritten"},
        {"name": "test_skips_empty_folio", "verifies": "Leads without folio skipped gracefully"}
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- External API endpoint is down or returns unexpected format
- A scraper dependency (URL, API structure) has changed since investigation
- The feature requires modifying the DB schema AND the dashboard (cross-boundary)
- Requirements conflict with existing behavior that tests enforce
