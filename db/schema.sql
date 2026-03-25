-- =============================================================================
-- Claim Remedy Adjusters — Lead Intelligence System
-- Supabase / PostgreSQL schema
-- =============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- leads table
-- -----------------------------------------------------------------------------
create table if not exists leads (
    id              text        primary key default gen_random_uuid()::text,
    dedup_hash      text        unique not null,           -- MD5(address|permit_date)[:12]

    -- Owner / Property
    owner_name      text        not null default 'Property Owner',
    address         text        not null,
    city            text        not null default 'Miami',
    zip             text        not null,
    folio_number    text        not null default '',

    -- Damage classification
    damage_type     text        not null
                    check (damage_type in (
                        'Hurricane/Wind', 'Flood', 'Roof', 'Fire', 'Structural'
                    )),

    -- Permit details
    permit_type     text        not null default '',
    permit_date     date        not null,
    storm_event     text        not null default '',

    -- Lead metadata
    lead_date       date        not null default current_date,
    score           smallint    not null default 30
                    check (score between 0 and 100),
    status          text        not null default 'New'
                    check (status in ('New', 'Contacted', 'Converted', 'Closed')),
    source          text        not null default 'permit'
                    check (source in ('permit', 'storm')),

    -- Contact info (nullable)
    contact_email   text,
    contact_phone   text,

    -- Outreach
    outreach_message text       not null default '',
    score_reasoning  text,

    -- Conversion tracking
    contacted_at    timestamptz,
    converted_at    timestamptz,
    claim_value     numeric,
    contact_method  text,
    notes           text,

    -- NOAA-specific fields (null for permit-sourced leads)
    noaa_episode_id  text,
    noaa_event_id    text,

    -- Multi-county + FEMA fields
    county                   text        not null default 'miami-dade',
    fema_declaration_number  text,
    fema_incident_type       text,

    -- Timestamps
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    enriched_at     timestamptz                           -- set after Claude enrichment
);

-- -----------------------------------------------------------------------------
-- storm_tracking table
-- -----------------------------------------------------------------------------
create table if not exists storm_tracking (
    candidate_id       text primary key,
    status             text not null default 'Watching'
                       check (status in (
                           'Watching',
                           'Researching',
                           'Outreach Ready',
                           'Contacted',
                           'Permit Filed',
                           'Closed'
                       )),
    notes              text,
    contacted_at       timestamptz,
    permit_filed_at    timestamptz,
    closed_at          timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists leads_zip_idx         on leads (zip);
create index if not exists leads_damage_type_idx on leads (damage_type);
create index if not exists leads_score_idx       on leads (score desc);
create index if not exists leads_status_idx      on leads (status);
create index if not exists leads_created_at_idx  on leads (created_at desc);
create index if not exists leads_permit_date_idx on leads (permit_date desc);
create index if not exists leads_source_idx      on leads (source);
create index if not exists leads_dedup_hash_idx  on leads (dedup_hash);
create index if not exists leads_county_idx      on leads (county);

-- Composite index for common dashboard queries
create index if not exists leads_status_score_idx
    on leads (status, score desc);

create index if not exists leads_zip_damage_idx
    on leads (zip, damage_type);

create index if not exists storm_tracking_status_idx
    on storm_tracking (status);

create index if not exists storm_tracking_updated_at_idx
    on storm_tracking (updated_at desc);

-- Partial index for unenriched leads (fast lookup for enrichment runner)
create index if not exists leads_unenriched_idx
    on leads (created_at)
    where outreach_message like 'TEMPLATE:%' or outreach_message = '';

-- -----------------------------------------------------------------------------
-- Auto-update updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_leads_updated_at on leads;
drop trigger if exists set_storm_tracking_updated_at on storm_tracking;

create trigger set_leads_updated_at
before update on leads
for each row
execute function update_updated_at_column();

create trigger set_storm_tracking_updated_at
before update on storm_tracking
for each row
execute function update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security (enable for Supabase)
-- -----------------------------------------------------------------------------
alter table leads enable row level security;

-- Allow service role full access (used by the scraper / API)
create policy "service_role_full_access" on leads
    for all
    to service_role
    using (true)
    with check (true);

-- Allow authenticated users read-only access (dashboard)
create policy "authenticated_read" on leads
    for select
    to authenticated
    using (true);

alter table storm_tracking enable row level security;

create policy "storm_tracking_service_role_full_access" on storm_tracking
    for all
    to service_role
    using (true)
    with check (true);

create policy "storm_tracking_dashboard_read" on storm_tracking
    for select
    to anon, authenticated
    using (true);

create policy "storm_tracking_dashboard_write" on storm_tracking
    for insert
    to anon, authenticated
    with check (true);

create policy "storm_tracking_dashboard_update" on storm_tracking
    for update
    to anon, authenticated
    using (true)
    with check (true);

-- -----------------------------------------------------------------------------
-- Migration: add multi-county + FEMA columns to existing databases
-- Run these if the leads table already exists:
-- -----------------------------------------------------------------------------
-- alter table leads add column if not exists county                  text not null default 'miami-dade';
-- alter table leads add column if not exists fema_declaration_number text;
-- alter table leads add column if not exists fema_incident_type      text;
-- create index if not exists leads_county_idx on leads (county);
--
-- Storm Watch migration:
-- create table if not exists storm_tracking (
--     candidate_id    text primary key,
--     status          text not null default 'Watching',
--     notes           text,
--     contacted_at    timestamptz,
--     permit_filed_at timestamptz,
--     closed_at       timestamptz,
--     created_at      timestamptz not null default now(),
--     updated_at      timestamptz not null default now()
-- );
