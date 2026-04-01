# Architecture

## System Overview

Lead intelligence system for a Florida property claim adjustment firm. Two main subsystems:

1. **Python Pipeline** — scrapes public data sources, enriches leads, scores them, upserts to Supabase, writes JSON for the dashboard
2. **React Dashboard** — SPA that reads JSON files and optionally connects to Supabase for persistence

## Data Flow

```
External APIs (ArcGIS, NOAA, FEMA, PA, Sunbiz)
  ↓
Scrapers (scrapers/*.py) — fetch raw data per source
  ↓
Pipeline (pipeline/leads.py) — canonicalize, deduplicate, enrich, score
  ↓
Two outputs from same canonical dataset:
  ├── db/insert.py → Supabase upsert (leads table)
  └── public/leads.json → Dashboard reads at runtime
```

## Key Modules

### Pipeline (pipeline/leads.py)
- `build_canonical_lead_dataset()` — orchestrates all stages, returns `PipelineResult`
- `write_leads_json()` — writes the canonical leads to `public/leads.json`
- All leads use snake_case keys internally; camelCase conversion happens at JSON output
- Runtime scripts that consume `public/leads.json` (e.g., `enrich_outreach.py`) receive camelCase rows unless they explicitly canonicalize input

### Scrapers (scrapers/)
- `permits.py` — ArcGIS permit APIs per county (multi-county config in `COUNTY_CONFIGS`)
- `storms.py` — NOAA CSV bulk download
- `fema.py` — FEMA OpenFEMA API v2
- `parcels.py` — Miami-Dade parcel layer for pre-permit leads
- `property.py` — Miami-Dade PA API for owner/homestead/value enrichment
- `voter_lookup.py` — local CSV/TSV voter file matching by name+address
- `sunbiz.py` — FL Sunbiz HTML scraper for LLC/business entity data
- `dedup.py` — MD5 hash-based deduplication (address + permit_date)

### Enrichment (enrichment/)
- `company_scoring.py` — algorithmic scoring with 15+ signal categories, base score 30, cap 0-100
- `ev_config.py` — expected value model (P(settled) × settlement × fee_rate), imported and used by `company_scoring.py` during scoring
- `outreach_prompt.py` — fallback TEMPLATE: placeholders + Claude prompt builder
- `enrich.py` — Supabase batch enrichment runner
- `score_prompt.py` — thin re-export of scoring function

### Database (db/)
- `schema.sql` / `setup_all.sql` — Supabase schema with RLS
- `insert.py` — upsert logic, preserves user-entered tracking fields
- `migrations/` — ordered SQL migrations (0001-0005)
- Tables: `leads`, `storm_tracking`, `cases`

### Dashboard (src/)
- Entry: `main.tsx` → `PasswordGate` → `BrowserRouter` → `App.tsx`
- App.tsx manages three views: Leads, Storm Watch, Cases, Analytics
- Data loaded from `public/leads.json` and `public/storm_candidates.json`
- Optional Supabase real-time via hooks in `src/lib/`
- Path alias: `@` → `./src`

## Scoring Architecture

Current: additive heuristic (base 30 + signal bonuses, clamped 0-100).
Target: hybrid with EV model integration and logarithmic compression to avoid ceiling saturation.

Key signals: peril type, insurer risk, permit recency, permit scope, contactability, storm linkage, permit status, underpayment, repeat damage, homestead, absentee owner, roof age, FEMA, assessed value, permit value.

## Security Model

- Browser: `VITE_SUPABASE_ANON_KEY` only, writes disabled by default
- Server: `SUPABASE_SERVICE_ROLE_KEY` for upserts
- RLS: anon/authenticated get select-only on leads, cases, storm_tracking

## CI/CD

- GitHub Actions: `scraper.yml` (every 6h, runs pipeline) → `enrich.yml` (after scraper, Claude outreach)
- Vercel: frontend deployment from `dist/`
- Railway: scraper cron (legacy, parallel to GHA)
