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

create index if not exists storm_tracking_status_idx
    on storm_tracking (status);

create index if not exists storm_tracking_updated_at_idx
    on storm_tracking (updated_at desc);

create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_storm_tracking_updated_at on storm_tracking;

create trigger set_storm_tracking_updated_at
before update on storm_tracking
for each row
execute function update_updated_at_column();

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
