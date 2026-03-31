-- Migration 0006: Add expected_value, score_breakdown, and outreach_sent_at columns.
-- These columns support the enrichment pipeline's expected-value scoring and
-- outreach tracking without requiring the scraper to set them.

alter table public.leads add column if not exists expected_value   numeric;
alter table public.leads add column if not exists score_breakdown jsonb;
alter table public.leads add column if not exists outreach_sent_at timestamptz;
