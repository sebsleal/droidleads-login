# AGENTS.md

## Commands

```bash
# Frontend
npm install            # install JS dependencies
npm run dev            # Vite dev server (default port 5173)
npm run build          # tsc + vite build → dist/
npm run preview        # serve built dist/ locally

# Python backend
pip install -r requirements.txt        # install Python deps (use venv/)
python3 run_scraper.py                 # full lead pipeline: scrape → enrich → upsert → write JSON
python3 enrich_leads.py                # Claude-powered lead enrichment
python3 enrich_outreach.py             # Claude-powered outreach message generation
python3 generate_storm_candidates.py   # regenerate public/storm_candidates.json

# Tests
python3 -m unittest discover -s tests -p 'test_*.py'   # all Python tests
python3 -m compileall company_data pipeline enrichment db scripts run_scraper.py generate_leads.py enrich_leads.py  # syntax check

# Deployment
# Frontend: Vercel (vercel.json config, builds dist/)
# Scraper: Railway cron (railway.toml, every 6 hours)
# CI: GitHub Actions — .github/workflows/scraper.yml (lead refresh) + enrich.yml (outreach enrichment, triggers after scraper)
```

## Architecture

This is a lead intelligence system for a property claim adjustment firm (Claim Remedy Adjusters), consisting of a Python scraper pipeline and a React/TypeScript dashboard.

### Python Pipeline (`run_scraper.py` → `pipeline/leads.py`)

Single canonical pipeline that produces all lead data. The flow:

1. **Scrapers** (`scrapers/`) — fetch raw data from external sources:
   - `permits.py` — building permits for Miami-Dade, Broward, Palm Beach counties
   - `storms.py` — NOAA storm events
   - `fema.py` — FEMA disaster declarations + claim windows
   - `parcels.py` — pre-permit parcel scan (storm-first leads)
   - `property.py` — property appraiser owner info enrichment
   - `dedup.py` — deduplication
   - `voter_lookup.py` — voter roll contact info
   - `sunbiz.py` — Florida LLC/business entity lookup

2. **Pipeline** (`pipeline/leads.py`) — `build_canonical_lead_dataset()` orchestrates all scrapers, produces snake_case lead dicts. `write_leads_json()` writes `public/leads.json` with `TEMPLATE:` outreach placeholders.

3. **Enrichment** (`enrichment/`) — post-pipeline enrichment:
   - `enrich.py` — lead field enrichment
   - `company_scoring.py` — algorithmic scoring with insurer risk
   - `outreach_prompt.py` — Anthropic Claude prompt for outreach messages
   - `score_prompt.py` — scoring prompt
   - `ev_config.py` — expected value configuration

4. **Database** (`db/`) — Supabase integration:
   - `insert.py` — upsert leads to Supabase `leads` table
   - `import_cases.py` — import case data
   - `schema.sql` / `setup_all.sql` — DB schema; migrations in `db/migrations/`

### React Dashboard (`src/`)

Vite + React 18 + TypeScript + Tailwind CSS SPA deployed on Vercel.

- **Entry**: `main.tsx` → `PasswordGate` → `BrowserRouter` → `App.tsx`
- **Data**: reads `public/leads.json` and `public/storm_candidates.json` at runtime; optional Supabase real-time via `src/lib/supabase.ts`
- **Routing**: `App.tsx` handles three views — Leads, Storm Watch, Cases
- **State**: local React state + optional Supabase persistence (tracking hooks in `src/lib/useTracking.ts`, `useStormTracking.ts`, `useCases.ts`)
- **Path alias**: `@` → `./src` (configured in `vite.config.ts` and `tsconfig.json`)

### Data Flow

The same canonical lead dataset from `pipeline/leads.py` feeds both:
- `db/insert.py` for Supabase upserts
- `public/leads.json` for the dashboard

There is no separate legacy path. Lead tracking lives on the `leads` table itself (no separate `lead_tracking` table).

### Security Model

- Browser uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Browser writes disabled by default (`VITE_ENABLE_BROWSER_WRITES=false`)
- Server scripts use `SUPABASE_SERVICE_ROLE_KEY`
- RLS policies: anon/authenticated `select` only; browser writes denied on `leads`, `cases`, `storm_tracking`

### CI/CD

- **scraper.yml**: Runs every 6 hours, executes `run_scraper.py`, commits updated `public/leads.json` and `public/storm_candidates.json`
- **enrich.yml**: Triggers after scraper completes, runs `enrich_outreach.py` with Anthropic API, commits enriched `public/leads.json`
- Commit messages use `[skip ci] [vercel skip]` to avoid deployment loops
