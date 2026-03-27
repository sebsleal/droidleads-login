-- Canonical storm-tracking table for Storm Watch candidates.

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
