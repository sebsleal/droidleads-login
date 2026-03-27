-- Canonical active-cases table.

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
