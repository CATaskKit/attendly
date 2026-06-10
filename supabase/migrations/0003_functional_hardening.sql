-- Functional hardening for live app flows.
-- Adds relationship/index support used by employee self-service and admin setup.

do $$ begin
  alter table public.profiles
    add constraint profiles_employee_id_fkey
    foreign key (employee_id) references public.employees (id) on delete set null;
exception when duplicate_object then null; end $$;

create unique index if not exists departments_org_name_unique
  on public.departments (org_id, lower(name));

create unique index if not exists leave_types_org_name_unique
  on public.leave_types (org_id, lower(name));

create unique index if not exists holidays_org_date_name_unique
  on public.holidays (org_id, date, lower(name));

create unique index if not exists leave_balances_employee_type_unique
  on public.leave_balances (org_id, employee_id, type)
  where employee_id is not null;

create index if not exists employees_profile_idx on public.employees (profile_id);
create index if not exists employees_email_idx on public.employees (org_id, lower(email));
create index if not exists leave_requests_employee_idx on public.leave_requests (employee_id, applied_at desc);
create index if not exists attendance_employee_day_idx on public.attendance (employee_id, day desc);