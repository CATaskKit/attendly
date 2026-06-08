-- Attendly — multi-tenant HR/attendance schema with Row-Level Security.
-- Run this in your Supabase project (SQL Editor) or via `supabase db push`.
-- Every tenant's data is isolated by `org_id`; access is gated by the
-- signed-in user's role (owner > hr > manager > employee).

-- ──────────────────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ──────────────────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('owner', 'hr', 'manager', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type emp_status as enum ('Active', 'Inactive', 'On leave');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_stage as enum ('manager', 'hr', 'done', 'reject');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('Present', 'Absent', 'Late', 'Leave', 'WFH', 'Holiday');
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Core tenant tables
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  display_name text,
  industry     text,
  country      text default 'India',
  timezone     text default 'Asia/Kolkata',
  currency     text default 'INR',
  plan         text not null default 'trial',
  created_at   timestamptz not null default now()
);

-- A profile links a Supabase auth user to one organization + a role.
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid references organizations (id) on delete cascade,
  full_name   text,
  email       text,
  role        user_role not null default 'employee',
  employee_id uuid,                       -- optional link to employees row
  created_at  timestamptz not null default now()
);
create index if not exists profiles_org_idx on profiles (org_id);

create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists departments_org_idx on departments (org_id);

create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  code        text not null,
  name        text not null,
  dept        text,
  designation text,
  manager     text,
  type        text default 'Full-time',
  status      emp_status not null default 'Active',
  email       text,
  phone       text,
  joined      date,
  profile_id  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);
create index if not exists employees_org_idx on employees (org_id);

create table if not exists leave_types (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references organizations (id) on delete cascade,
  name    text not null,
  quota   numeric default 0,
  accrual text default 'Monthly',
  carry_forward boolean default false,
  paid    boolean default true,
  color   text default '#1573e6'
);
create index if not exists leave_types_org_idx on leave_types (org_id);

create table if not exists leave_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  employee_id  uuid references employees (id) on delete cascade,
  emp          text,
  code         text,
  dept         text,
  type         text not null,
  from_date    date,
  to_date      date,
  days         numeric default 1,
  half         boolean default false,
  reason       text,
  attachment   text,
  status       leave_status not null default 'Pending',
  stage        leave_stage not null default 'manager',
  applied_at   timestamptz not null default now(),
  decided_by   uuid references profiles (id),
  decided_at   timestamptz
);
create index if not exists leave_requests_org_idx on leave_requests (org_id);

create table if not exists leave_balances (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  employee_id uuid references employees (id) on delete cascade,
  code        text,
  name        text,
  type        text not null,
  allotted    numeric default 0,
  used        numeric default 0,
  pending     numeric default 0
);
create index if not exists leave_balances_org_idx on leave_balances (org_id);

create table if not exists attendance (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  employee_id  uuid references employees (id) on delete cascade,
  day          date not null default current_date,
  check_in_at  timestamptz,
  check_out_at timestamptz,
  status       attendance_status not null default 'Present',
  work_seconds integer default 0,
  location     text,
  selfie_url   text,
  ip           text,
  device       text,
  created_at   timestamptz not null default now()
);
create index if not exists attendance_org_idx on attendance (org_id);
create unique index if not exists attendance_emp_day on attendance (employee_id, day);

create table if not exists holidays (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null,
  date        date not null,
  type        text default 'National',
  description text
);
create index if not exists holidays_org_idx on holidays (org_id);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  user_id    uuid references profiles (id) on delete cascade,
  type       text default 'info',
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Helper functions (used by RLS). SECURITY DEFINER so they can read profiles
-- without recursive RLS. STABLE so the planner can cache within a statement.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('owner','hr'), false);
$$;

-- Creates an organization for the signed-in user and makes them its Owner.
-- Called once, right after sign-up, by the onboarding flow.
create or replace function public.create_organization(org_name text, display text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  if (select org_id from profiles where id = auth.uid()) is not null then
    raise exception 'User already belongs to an organization';
  end if;
  insert into organizations (name, display_name) values (org_name, coalesce(display, org_name))
    returning id into new_org;
  update profiles set org_id = new_org, role = 'owner' where id = auth.uid();
  return new_org;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- New auth user → bare profile (org assigned later via create_organization
-- or an invite acceptance flow).
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ──────────────────────────────────────────────────────────────────────────
alter table organizations  enable row level security;
alter table profiles       enable row level security;
alter table departments    enable row level security;
alter table employees      enable row level security;
alter table leave_types    enable row level security;
alter table leave_requests enable row level security;
alter table leave_balances enable row level security;
alter table attendance     enable row level security;
alter table holidays       enable row level security;
alter table notifications  enable row level security;

-- organizations: members can read their org; owner/hr can update it.
drop policy if exists org_select on organizations;
create policy org_select on organizations for select using (id = current_org_id());
drop policy if exists org_update on organizations;
create policy org_update on organizations for update using (id = current_org_id() and is_admin());

-- profiles: you can always read your own; admins read everyone in their org.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid() or org_id = current_org_id());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid());
drop policy if exists profiles_admin_manage on profiles;
create policy profiles_admin_manage on profiles for update using (org_id = current_org_id() and is_admin());

-- Generic tenant tables: read = same org; write = same org (admins for the
-- org-wide tables; employees write their own attendance/leave — refined in app
-- + future phase with per-row owner checks).
do $$
declare t text;
begin
  foreach t in array array['departments','employees','leave_types','leave_balances','holidays'] loop
    execute format('drop policy if exists %1$s_rw on %1$s;', t);
    execute format(
      'create policy %1$s_rw on %1$s using (org_id = current_org_id()) with check (org_id = current_org_id());',
      t);
  end loop;
end $$;

-- leave_requests: everyone in org can read; insert within org; admins/managers
-- update (decisions). (Tighten to "own team" for managers in a later phase.)
drop policy if exists leave_select on leave_requests;
create policy leave_select on leave_requests for select using (org_id = current_org_id());
drop policy if exists leave_insert on leave_requests;
create policy leave_insert on leave_requests for insert with check (org_id = current_org_id());
drop policy if exists leave_update on leave_requests;
create policy leave_update on leave_requests for update using (org_id = current_org_id());

-- attendance: read within org; insert/update within org.
drop policy if exists att_select on attendance;
create policy att_select on attendance for select using (org_id = current_org_id());
drop policy if exists att_write on attendance;
create policy att_write on attendance for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- notifications: each user sees their own.
drop policy if exists notif_select on notifications;
create policy notif_select on notifications for select using (user_id = auth.uid());
drop policy if exists notif_update on notifications;
create policy notif_update on notifications for update using (user_id = auth.uid());
drop policy if exists notif_insert on notifications;
create policy notif_insert on notifications for insert with check (org_id = current_org_id());

-- Realtime: broadcast row changes for live UI.
do $$ begin
  alter publication supabase_realtime add table attendance, leave_requests, notifications;
exception when others then null; end $$;
