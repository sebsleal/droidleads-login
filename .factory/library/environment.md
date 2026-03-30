# Environment

## Required Environment Variables

### Python Pipeline (server-side)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for DB writes
- `ANTHROPIC_API_KEY` — Claude API key for outreach enrichment
- `OUTREACH_PHONE` — configurable phone number for outreach templates (optional, falls back to placeholder)

### React Dashboard (browser-side, prefixed VITE_)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — anon key for read-only queries
- `VITE_ENABLE_BROWSER_WRITES` — "true" to enable writes (default: disabled)
- `VITE_APP_PASSWORD` — password for PasswordGate authentication

## Python Dependencies
`requirements.txt`: requests, python-dotenv, supabase, openpyxl, pdfplumber, pypdf, anthropic

## Node Dependencies
React 18, react-router-dom 6, @supabase/supabase-js, Tailwind CSS 3, Recharts, lucide-react, Vite 5, TypeScript 5

## External Services
- Supabase (remote, shared between pipeline and dashboard)
- No local database required
- No Redis or cache services
