# User Testing

## Validation Surface

### Browser (agent-browser)
- **URL**: `http://localhost:5173`
- **Start**: `npm run dev` (Vite dev server)
- **Views**: Leads (`/`), Storm Watch (`/storm-watch`), Cases (`/cases`), Analytics (`/analytics`)
- **Auth**: PasswordGate — requires `VITE_APP_PASSWORD` env var. If not set, gate may be bypassed or show empty.
- **Data**: Reads `public/leads.json` and `public/storm_candidates.json` at runtime
- **Supabase**: Optional — dashboard works in read-only mode from JSON files alone

### Python CLI
- **Test command**: `python3 -m unittest discover -s tests -p 'test_*.py'`
- **Compile check**: `python3 -m compileall company_data pipeline enrichment db scripts`
- **No venv activation needed** if dependencies installed globally; otherwise `source venv/bin/activate` first

## Validation Concurrency

### agent-browser
- Machine: 16 GB RAM, 10 CPU cores
- Vite dev server: ~200 MB RAM
- Each agent-browser instance: ~300 MB RAM
- Headroom (70% of available): ~8.4 GB
- **Max concurrent validators: 4**
- Rationale: 4 instances × 300 MB + dev server 200 MB = 1.4 GB, well within budget

### python-test
- Lightweight, no services needed
- **Max concurrent validators: 5**

## Flow Validator Guidance: python-test
- Scope: run only the assertion-linked Python unit tests needed for assigned assertions; avoid broad refactors or unrelated commands.
- Isolation boundary: stay inside `/Users/seb/Documents/claim-remedy-leads-testing`; do not access `.env` / `.env.local` or external services.
- Network boundary: do not introduce real outbound HTTP calls; rely on tests that mock scraper/network behavior.
- Data boundary: do not regenerate `public/leads.json` or `public/storm_candidates.json`.
- Evidence: include exact commands, exit codes, and assertion-to-test mapping in flow report JSON.

## Flow Validator Guidance: agent-browser
- Scope: validate only assigned browser assertions and capture evidence under the assigned milestone/group evidence directory.
- Isolation boundary: use only the assigned URL and browser session; do not change global app config or env files.
- Primary route for conversion assertions (`VAL-EXPAND-004`, `VAL-EXPAND-005`, `VAL-CROSS-005`): use `http://localhost:5173/fixtures/convert-case` which provides an isolated Converted-lead fixture and case-creation flow without mutating real leads.
- Shared-state boundary: fixture-created cases are acceptable test data for validation; do not attempt to mutate production Supabase records.
- Evidence: capture screenshots/DOM checks for button visibility, prefilled modal fields, and case presence in `/cases` after submit.

## Testing Notes
- Dashboard data comes from static JSON files in `public/` — no Supabase connection needed for validation
- For testing browser write features (readOnly), set `VITE_ENABLE_BROWSER_WRITES=false` (default)
- Cases data comes from Supabase `cases` table — may be empty in local dev
- leads.json has ~13,000 entries — pagination testing needs this volume
