-- =============================================================================
-- Claim Remedy Adjusters — Active Cases Table
-- Run this in the Supabase SQL editor to add case management support.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- cases table — active client cases imported from CRM
-- -----------------------------------------------------------------------------
create table if not exists cases (
    id                   uuid        primary key default gen_random_uuid(),
    file_number          text        unique not null,       -- e.g. '2024010001'
    client_name          text        not null,
    loss_address         text        not null,
    mailing_address      text,
    loss_date            date,
    peril_type           text,                              -- e.g. 'Accidental Discharge', 'Hurricane'
    insurance_company    text,
    policy_number        text,
    claim_number         text,
    phone                text,
    email                text,
    status_phase         text        not null default 'OpenPhase: Claim Originated'
                         check (status_phase in (
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
                         )),
    fee_rate             numeric(5,4),                      -- e.g. 0.20 = 20%
    fee_disbursed        numeric(12,2),                     -- actual cash received
    estimated_loss       numeric(12,2),
    date_logged          date        not null default current_date,
    -- Process checklist (boolean flags)
    lor                  boolean     not null default false,
    plumbing_invoice     boolean     not null default false,
    water_mitigation     boolean     not null default false,
    -- Process dates
    estimate_date        date,
    inspection_date      date,
    srl_date             date,
    cdl1_date            date,
    cdl2_date            date,
    cdl3_date            date,
    -- Notes
    notes                text,
    -- Timestamps
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists cases_status_phase_idx      on cases (status_phase);
create index if not exists cases_insurance_company_idx on cases (insurance_company);
create index if not exists cases_peril_type_idx        on cases (peril_type);
create index if not exists cases_loss_date_idx         on cases (loss_date desc);
create index if not exists cases_date_logged_idx       on cases (date_logged desc);
create index if not exists cases_fee_disbursed_idx     on cases (fee_disbursed desc nulls last);

-- Partial index: open cases only (for pipeline value queries)
create index if not exists cases_open_idx
    on cases (date_logged desc)
    where status_phase like 'OpenPhase:%';

-- -----------------------------------------------------------------------------
-- Auto-update updated_at trigger (reuses function from main schema)
-- -----------------------------------------------------------------------------
drop trigger if exists set_cases_updated_at on cases;

create trigger set_cases_updated_at
before update on cases
for each row
execute function update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table cases enable row level security;

-- Service role: full access (used by scraper / import script)
create policy "cases_service_role_full_access" on cases
    for all
    to service_role
    using (true)
    with check (true);

-- Authenticated + anon: read
create policy "cases_read" on cases
    for select
    to anon, authenticated
    using (true);

-- Authenticated + anon: write (dashboard edits)
create policy "cases_write" on cases
    for update
    to anon, authenticated
    using (true)
    with check (true);

create policy "cases_insert" on cases
    for insert
    to anon, authenticated
    with check (true);

-- -----------------------------------------------------------------------------
-- Migration: if cases table already exists, add missing columns
-- -----------------------------------------------------------------------------
-- alter table cases add column if not exists appraisal_date date;
-- alter table cases add column if not exists mediation_date date;
