-- Claim Remedy Lead Intelligence
-- One-time Supabase setup for a fresh or drifted environment.
-- Paste this entire file into the Supabase SQL editor and run it once.

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
    updated_at               timestamptz not null default now()
);

alter table public.leads add column if not exists source_detail text not null default 'permit';
alter table public.leads add column if not exists homestead boolean;
alter table public.leads add column if not exists owner_mailing_address text;
alter table public.leads add column if not exists assessed_value numeric;
alter table public.leads add column if not exists permit_status text;
alter table public.leads add column if not exists contractor_name text;
alter table public.leads add column if not exists permit_value numeric;
alter table public.leads add column if not exists underpaid_flag boolean not null default false;
alter table public.leads add column if not exists absentee_owner boolean;
alter table public.leads add column if not exists prior_permit_count integer not null default 0;
alter table public.leads add column if not exists roof_age integer;
alter table public.leads add column if not exists insurance_company text;
alter table public.leads add column if not exists insurer_risk text;
alter table public.leads add column if not exists insurer_risk_label text;
alter table public.leads add column if not exists expected_value numeric;
alter table public.leads add column if not exists score_breakdown jsonb;
alter table public.leads add column if not exists outreach_sent_at timestamptz;

update public.leads
set damage_type = 'Accidental Discharge'
where lower(coalesce(damage_type, '')) in (
    'bathroom',
    'bath',
    'm bath',
    'h bath',
    'hall bath',
    'plumbing failure',
    'pipe break',
    'a/c leak',
    'ac leak',
    'water mold',
    'plumbing mold',
    'bathroom mold'
);

update public.leads
set source = 'storm'
where source = 'storm-first';

update public.leads
set source_detail = case
    when source = 'permit' then 'permit'
    when source = 'storm' and permit_type = 'Pre-Permit Storm Opportunity' then 'storm_first'
    when source = 'storm' then 'storm_event'
    else 'permit'
end
where source_detail is null
   or source_detail not in ('permit', 'storm_event', 'storm_first');

alter table public.leads
    drop constraint if exists leads_damage_type_check,
    drop constraint if exists leads_status_check,
    drop constraint if exists leads_source_check,
    drop constraint if exists leads_source_detail_check,
    drop constraint if exists leads_insurer_risk_check,
    drop constraint if exists leads_permit_status_check;

alter table public.leads
    add constraint leads_damage_type_check check (
        damage_type in (
            'Hurricane/Wind',
            'Flood',
            'Roof',
            'Fire',
            'Structural',
            'Accidental Discharge'
        )
    ),
    add constraint leads_status_check check (
        status in ('New', 'Contacted', 'Converted', 'Closed')
    ),
    add constraint leads_source_check check (
        source in ('permit', 'storm')
    ),
    add constraint leads_source_detail_check check (
        source_detail in ('permit', 'storm_event', 'storm_first')
    ),
    add constraint leads_insurer_risk_check check (
        insurer_risk is null or insurer_risk in ('high', 'medium', 'low')
    ),
    add constraint leads_permit_status_check check (
        permit_status is null or permit_status in (
            'No Contractor',
            'Owner-Builder',
            'Stalled',
            'Active'
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

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row
execute function public.update_updated_at_column();

create table if not exists public.cases (
    id                   uuid primary key default gen_random_uuid(),
    file_number          text unique not null,
    client_name          text not null,
    loss_address         text not null,
    mailing_address      text,
    loss_date            date,
    peril_type           text,
    insurance_company    text,
    policy_number        text,
    claim_number         text,
    phone                text,
    email                text,
    status_phase         text not null default 'OpenPhase: Claim Originated',
    fee_rate             numeric(5,4),
    fee_disbursed        numeric(12,2),
    estimated_loss       numeric(12,2),
    date_logged          date not null default current_date,
    lor                  boolean not null default false,
    plumbing_invoice     boolean not null default false,
    water_mitigation     boolean not null default false,
    estimate_date        date,
    inspection_date      date,
    srl_date             date,
    cdl1_date            date,
    cdl2_date            date,
    cdl3_date            date,
    notes                text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

update public.cases
set status_phase = case
    when lower(coalesce(status_phase, '')) in ('openphase: litigation', 'open phase: litigation') then 'Litigation'
    when lower(coalesce(status_phase, '')) in ('closed without pay', 'closed without payment') then 'Closed w/o Pay'
    else status_phase
end
where status_phase in (
    'OpenPhase: Litigation',
    'Open Phase: Litigation',
    'Closed without pay',
    'Closed without payment'
);

alter table public.cases
    drop constraint if exists cases_status_phase_check;

alter table public.cases
    add constraint cases_status_phase_check check (
        status_phase in (
            'Settled',
            'Litigation',
            'Appraisal',
            'Closed w/o Pay',
            'OpenPhase: Estimating',
            'OpenPhase: Inspection',
            'OpenPhase: Appraisal',
            'OpenPhase: Mortgage Processing',
            'OpenPhase: Negotiation',
            'OpenPhase: Mediation',
            'OpenPhase: Initial Payment',
            'OpenPhase: Under Review',
            'OpenPhase: Claim Originated',
            'OpenPhase: Recovering Depreciation',
            'OpenPhase: Ready to Close',
            'OpenPhase: Settled'
        )
    );

create index if not exists cases_status_phase_idx on public.cases (status_phase);
create index if not exists cases_insurance_company_idx on public.cases (insurance_company);
create index if not exists cases_peril_type_idx on public.cases (peril_type);
create index if not exists cases_loss_date_idx on public.cases (loss_date desc);
create index if not exists cases_date_logged_idx on public.cases (date_logged desc);
create index if not exists cases_fee_disbursed_idx on public.cases (fee_disbursed desc nulls last);
create index if not exists cases_open_idx
    on public.cases (date_logged desc)
    where status_phase like 'OpenPhase:%';

drop trigger if exists set_cases_updated_at on public.cases;
create trigger set_cases_updated_at
before update on public.cases
for each row
execute function public.update_updated_at_column();

create table if not exists public.storm_tracking (
    candidate_id       text primary key,
    status             text not null default 'Watching',
    notes              text,
    contacted_at       timestamptz,
    permit_filed_at    timestamptz,
    closed_at          timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

alter table public.storm_tracking
    drop constraint if exists storm_tracking_status_check;

alter table public.storm_tracking
    add constraint storm_tracking_status_check check (
        status in (
            'Watching',
            'Researching',
            'Outreach Ready',
            'Contacted',
            'Permit Filed',
            'Closed'
        )
    );

create index if not exists storm_tracking_status_idx on public.storm_tracking (status);
create index if not exists storm_tracking_updated_at_idx on public.storm_tracking (updated_at desc);

drop trigger if exists set_storm_tracking_updated_at on public.storm_tracking;
create trigger set_storm_tracking_updated_at
before update on public.storm_tracking
for each row
execute function public.update_updated_at_column();

alter table public.leads enable row level security;
alter table public.cases enable row level security;
alter table public.storm_tracking enable row level security;

drop policy if exists service_role_full_access on public.leads;
drop policy if exists authenticated_read on public.leads;
drop policy if exists leads_service_role_full_access on public.leads;
drop policy if exists leads_dashboard_read_only on public.leads;

create policy leads_service_role_full_access on public.leads
    for all
    to service_role
    using (true)
    with check (true);

create policy leads_dashboard_read_only on public.leads
    for select
    to anon, authenticated
    using (true);

drop policy if exists cases_service_role_full_access on public.cases;
drop policy if exists cases_read on public.cases;
drop policy if exists cases_write on public.cases;
drop policy if exists cases_insert on public.cases;
drop policy if exists cases_dashboard_read_only on public.cases;

create policy cases_service_role_full_access on public.cases
    for all
    to service_role
    using (true)
    with check (true);

create policy cases_dashboard_read_only on public.cases
    for select
    to anon, authenticated
    using (true);

drop policy if exists storm_tracking_service_role_full_access on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_read on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_write on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_update on public.storm_tracking;
drop policy if exists storm_tracking_dashboard_read_only on public.storm_tracking;

create policy storm_tracking_service_role_full_access on public.storm_tracking
    for all
    to service_role
    using (true)
    with check (true);

create policy storm_tracking_dashboard_read_only on public.storm_tracking
    for select
    to anon, authenticated
    using (true);
