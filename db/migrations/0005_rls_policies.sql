-- Secure-by-default RLS. Browser clients get read-only access.

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
