# Claim Remedy Lead Intelligence

This repo now runs on a single canonical lead pipeline. `run_scraper.py` calls [`pipeline/leads.py`](/Users/seb/Documents/claim-remedy-leads-testing/pipeline/leads.py), which builds one snake_case lead dataset and reuses that exact dataset for both Supabase upserts and [`public/leads.json`](/Users/seb/Documents/claim-remedy-leads-testing/public/leads.json). The dashboard no longer depends on a separate legacy lead rebuild path.

## Architecture

1. `run_scraper.py` builds canonical leads through `pipeline/leads.py`.
2. The canonical dataset is enriched, deduplicated, scored, and stamped with `TEMPLATE:` placeholders once.
3. The same rows go to:
   - [`db/insert.py`](/Users/seb/Documents/claim-remedy-leads-testing/db/insert.py) for Supabase upserts
   - [`public/leads.json`](/Users/seb/Documents/claim-remedy-leads-testing/public/leads.json) for the UI
4. Lead tracking lives on the `leads` table itself. There is no separate `lead_tracking` table.
5. Company outcome analytics come from [`src/data/companyMetrics.json`](/Users/seb/Documents/claim-remedy-leads-testing/src/data/companyMetrics.json), which is generated from local PDFs by [`scripts/derive_company_metrics.py`](/Users/seb/Documents/claim-remedy-leads-testing/scripts/derive_company_metrics.py).

## Security Model

- Browser code uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Browser writes are disabled by default with `VITE_ENABLE_BROWSER_WRITES=false`.
- Server-side scripts use `SUPABASE_SERVICE_ROLE_KEY` only.
- The checked-in RLS policies allow anon/authenticated `select` access and deny browser writes to `leads`, `cases`, and `storm_tracking`.
- If you want editable tracking in production, add authenticated server endpoints or a real auth flow before re-enabling writes.

## Company Data Handling

- Raw PDFs stay outside the repo.
- The committed JSON metrics file contains aggregate, sanitized metrics only.
- The current derivation uses:
  - `All Claims.xlsx - Sheet1.pdf` for historical claim outcomes and fee signals
  - `Client Process Tracking - Claim Tracker.pdf` for workflow coverage, backlog, and duration signals
  - `Data Analysis - Graphs.pdf` as a validation artifact only when text extraction is not available

## Setup

1. Install Python dependencies: `pip install -r requirements.txt`
2. Install frontend dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in the required values.
4. Easiest one-time DB setup: paste [`db/setup_all.sql`](/Users/seb/Documents/claim-remedy-leads-testing/db/setup_all.sql) into the Supabase SQL editor and run it once.
5. If you prefer migration-by-migration setup, apply the ordered SQL migrations in [`db/migrations`](/Users/seb/Documents/claim-remedy-leads-testing/db/migrations) from `0001` through `0006`.
6. Generate sanitized company metrics from your local PDFs:

```bash
python3 scripts/derive_company_metrics.py \
  --claims-pdf "/path/to/All Claims.xlsx - Sheet1.pdf" \
  --tracker-pdf "/path/to/Client Process Tracking - Claim Tracker.pdf" \
  --graphs-pdf "/path/to/Data Analysis - Graphs.pdf"
```

7. Run `python3 run_scraper.py` to refresh canonical leads and `public/leads.json`.

## Verification

- `python3 -m compileall company_data pipeline enrichment db scripts run_scraper.py generate_leads.py enrich_leads.py`
- `python3 -m unittest discover -s tests -p 'test_*.py'`
- `npm run build`
