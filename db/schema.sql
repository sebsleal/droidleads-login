-- Claim Remedy Adjusters — canonical snapshot for leads + storm tracking.
-- Prefer the ordered migrations in db/migrations/, but this file mirrors the
-- current schema for manual setup in a fresh environment.

create extension if not exists "pgcrypto";

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create table if not exists public.leads (
    id                       text primary key default gen_random_uuid()::text,
    dedup_hash               text not null unique,
    owner_name               text not null default 'Property Owner',
    address                  text not null,
    city                     text not null default 'Miami',
    zip                      text not null,
    folio_number             text not null default '',
    damage_type              text not null,
    permit_type              text not null default '',
    permit_date              date not null,
    storm_event              text not null default '',
    lead_date                date not null default current_date,
    score                    smallint not null default 30,
    status                   text not null default 'New',
    source                   text not null default 'permit',
    source_detail            text not null default 'permit',
    contact_email            text,
    contact_phone            text,
    outreach_message         text not null default '',
    score_reasoning          text,
    contacted_at             timestamptz,
    converted_at             timestamptz,
    claim_value              numeric,
    contact_method           text,
    notes                    text,
    noaa_episode_id          text,
    noaa_event_id            text,
    county                   text not null default 'miami-dade',
    fema_declaration_number  text,
    fema_incident_type       text,
    homestead                boolean,
    owner_mailing_address    text,
    assessed_value           numeric,
    permit_status            text,
    contractor_name          text,
    permit_value             numeric,
    underpaid_flag           boolean not null default false,
    absentee_owner           boolean,
    prior_permit_count       integer not null default 0,
    roof_age                 integer,
    insurance_company        text,
    insurer_risk             text,
    insurer_risk_label       text,
    enriched_at              timestamptz,
    expected_value          numeric,
    score_breakdown         jsonb,
    outreach_sent_at        timestamptz,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    constraint leads_damage_type_check check (
        damage_type in (
            'Hurricane/Wind',
            'Flood',
            'Roof',
            'Fire',
            'Structural',
            'Accidental Discharge'
        )
    ),
    constraint leads_status_check check (
        status in ('New', 'Contacted', 'Converted', 'Closed')
    ),
    constraint leads_source_check check (
        source in ('permit', 'storm')
    ),
    constraint leads_source_detail_check check (
        source_detail in ('permit', 'storm_event', 'storm_first')
    ),
    constraint leads_insurer_risk_check check (
        insurer_risk is null or insurer_risk in ('high', 'medium', 'low')
    ),
    constraint leads_permit_status_check check (
        permit_status is null or permit_status in (
            'No Contractor',
            'Owner-Builder',
            'Stalled',
            'Active'
        )
    )
);

create table if not exists public.storm_tracking (
    candidate_id       text primary key,
    status             text not null default 'Watching',
    notes              text,
    contacted_at       timestamptz,
    permit_filed_at    timestamptz,
    closed_at          timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint storm_tracking_status_check check (
        status in (
            'Watching',
            'Researching',
            'Outreach Ready',
            'Contacted',
            'Permit Filed',
            'Closed'
        )
    )
);

create unique index if not exists leads_dedup_hash_unique_idx on public.leads (dedup_hash);
create index if not exists leads_zip_idx on public.leads (zip);
create index if not exists leads_damage_type_idx on public.leads (damage_type);
create index if not exists leads_score_idx on public.leads (score desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_permit_date_idx on public.leads (permit_date desc);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_source_detail_idx on public.leads (source_detail);
create index if not exists leads_county_idx on public.leads (county);
create index if not exists leads_status_score_idx on public.leads (status, score desc);
create index if not exists leads_zip_damage_idx on public.leads (zip, damage_type);
create index if not exists leads_unenriched_idx
    on public.leads (created_at)
    where outreach_message like 'TEMPLATE:%' or coalesce(outreach_message, '') = '';
create index if not exists storm_tracking_status_idx on public.storm_tracking (status);
create index if not exists storm_tracking_updated_at_idx on public.storm_tracking (updated_at desc);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_storm_tracking_updated_at on public.storm_tracking;
create trigger set_storm_tracking_updated_at
before update on public.storm_tracking
for each row
execute function public.update_updated_at_column();

alter table public.leads enable row level security;
alter table public.storm_tracking enable row level security;

drop policy if exists service_role_full_access on public.leads;
drop policy if exists authenticated_read on public.leads;
drop policy if exists leads_service_role_full_access on public.leads;
drop policy if exists leads_dashboard_read_only on public.leads;
drop policy if exists storm_tracking_service_role_full_access on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_read on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_write on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_update on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_read_only on public.storm_tracking;

create policy leads_service_role_full_access on public.leads
    for all
    to service_role
    using (true)
    with check (true);

create policy leads_dashboard_read_only on public.leads
    for select
    to anon, authenticated
    using (true);

create policy storm_tracking_service_role_full_access on public.storm_tracking
    for all
    to service_role
    using (true)
    with check (true);

create policy storm_tracking_dashboard_read_only on public.storm_tracking
    for select
    to anon, authenticated
    using (true);
