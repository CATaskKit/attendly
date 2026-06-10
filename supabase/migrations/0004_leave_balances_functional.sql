-- Fully functional leave balances:
-- - create one balance row per employee and configured leave type
-- - keep used/pending in sync with leave request status changes
-- - enforce the configured maximum cap for new requested days
-- - expose per-login balance/application RPCs for the employee app

alter table public.leave_balances
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists leave_balances_org_employee_type_unique
  on public.leave_balances (org_id, employee_id, type);

do $$ begin
  alter table public.leave_balances
    add constraint leave_balances_amounts_non_negative
    check (allotted >= 0 and used >= 0 and pending >= 0) not valid;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leave_requests
    add constraint leave_requests_days_positive
    check (days > 0) not valid;
exception when duplicate_object then null; end $$;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    p.employee_id,
    (select e.id from employees e where e.org_id = p.org_id and e.profile_id = p.id order by e.created_at limit 1),
    (select e.id from employees e where e.org_id = p.org_id and p.email is not null and lower(e.email) = lower(p.email) order by e.created_at limit 1)
  )
  from profiles p
  where p.id = auth.uid();
$$;

create or replace function public.ensure_employee_leave_balances(p_org_id uuid, p_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.leave_balances (org_id, employee_id, code, name, type, allotted, used, pending, updated_at)
  select e.org_id, e.id, e.code, e.name, lt.name, greatest(coalesce(lt.quota, 0), 0), 0, 0, now()
  from public.employees e
  join public.leave_types lt on lt.org_id = e.org_id
  where e.org_id = p_org_id
    and e.id = p_employee_id
    and lt.name is not null
  on conflict (org_id, employee_id, type) do update
    set code = excluded.code,
        name = excluded.name,
        allotted = excluded.allotted,
        updated_at = now();
end;
$$;

create or replace function public.sync_leave_balances_for_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_employee_leave_balances(new.org_id, new.id);
  return new;
end;
$$;

drop trigger if exists employees_leave_balances_sync on public.employees;
create trigger employees_leave_balances_sync
  after insert or update of code, name, org_id on public.employees
  for each row execute function public.sync_leave_balances_for_employee();

create or replace function public.sync_leave_balances_for_leave_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.leave_balances (org_id, employee_id, code, name, type, allotted, used, pending, updated_at)
    select e.org_id, e.id, e.code, e.name, new.name, greatest(coalesce(new.quota, 0), 0), 0, 0, now()
    from public.employees e
    where e.org_id = new.org_id
    on conflict (org_id, employee_id, type) do update
      set code = excluded.code,
          name = excluded.name,
          allotted = excluded.allotted,
          updated_at = now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.leave_balances
      set type = new.name,
          allotted = greatest(coalesce(new.quota, 0), 0),
          updated_at = now()
      where org_id = new.org_id
        and type = old.name;

    insert into public.leave_balances (org_id, employee_id, code, name, type, allotted, used, pending, updated_at)
    select e.org_id, e.id, e.code, e.name, new.name, greatest(coalesce(new.quota, 0), 0), 0, 0, now()
    from public.employees e
    where e.org_id = new.org_id
    on conflict (org_id, employee_id, type) do nothing;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists leave_types_leave_balances_sync on public.leave_types;
create trigger leave_types_leave_balances_sync
  after insert or update of name, quota on public.leave_types
  for each row execute function public.sync_leave_balances_for_leave_type();

create or replace function public.leave_balance_effect_total(p_status public.leave_status, p_days numeric)
returns numeric language sql immutable as $$
  select case when p_status in ('Pending', 'Approved') then greatest(coalesce(p_days, 0), 0) else 0 end;
$$;

create or replace function public.apply_leave_balance_delta(
  p_org_id uuid,
  p_employee_id uuid,
  p_type text,
  p_days numeric,
  p_status public.leave_status,
  p_sign integer,
  p_enforce_cap boolean default true
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_balance public.leave_balances%rowtype;
  v_used_delta numeric := 0;
  v_pending_delta numeric := 0;
  v_next_used numeric := 0;
  v_next_pending numeric := 0;
  v_requested numeric := 0;
  v_available numeric := 0;
begin
  if p_employee_id is null or p_type is null or coalesce(p_days, 0) <= 0 then
    return;
  end if;

  if p_status = 'Pending' then
    v_pending_delta := p_days * p_sign;
  elsif p_status = 'Approved' then
    v_used_delta := p_days * p_sign;
  else
    return;
  end if;

  perform public.ensure_employee_leave_balances(p_org_id, p_employee_id);

  select *
    into v_balance
    from public.leave_balances
    where org_id = p_org_id
      and employee_id = p_employee_id
      and lower(type) = lower(p_type)
    for update;

  if not found then
    raise exception 'Leave type "%" is not configured for this employee.', p_type;
  end if;

  v_next_used := greatest(0, coalesce(v_balance.used, 0) + v_used_delta);
  v_next_pending := greatest(0, coalesce(v_balance.pending, 0) + v_pending_delta);
  v_requested := greatest(0, v_used_delta + v_pending_delta);
  v_available := greatest(0, coalesce(v_balance.allotted, 0) - coalesce(v_balance.used, 0) - coalesce(v_balance.pending, 0));

  if p_enforce_cap and v_requested > 0 and (v_next_used + v_next_pending) > coalesce(v_balance.allotted, 0) then
    raise exception 'Not enough % leave balance. Available: %, requested: %.', v_balance.type, v_available, v_requested;
  end if;

  update public.leave_balances
    set used = v_next_used,
        pending = v_next_pending,
        updated_at = now()
    where id = v_balance.id;
end;
$$;

create or replace function public.sync_leave_request_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old_total numeric := 0;
  v_new_total numeric := 0;
  v_changed_bucket boolean := false;
  v_enforce_cap boolean := true;
begin
  if tg_op = 'INSERT' then
    perform public.apply_leave_balance_delta(new.org_id, new.employee_id, new.type, new.days, new.status, 1, true);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.apply_leave_balance_delta(old.org_id, old.employee_id, old.type, old.days, old.status, -1, false);
    return old;
  end if;

  perform public.apply_leave_balance_delta(old.org_id, old.employee_id, old.type, old.days, old.status, -1, false);

  v_old_total := public.leave_balance_effect_total(old.status, old.days);
  v_new_total := public.leave_balance_effect_total(new.status, new.days);
  v_changed_bucket := new.employee_id is distinct from old.employee_id or new.type is distinct from old.type;
  v_enforce_cap := v_changed_bucket or v_new_total > v_old_total;

  perform public.apply_leave_balance_delta(new.org_id, new.employee_id, new.type, new.days, new.status, 1, v_enforce_cap);
  return new;
end;
$$;

drop trigger if exists leave_requests_leave_balances_sync on public.leave_requests;
create trigger leave_requests_leave_balances_sync
  before insert or update or delete on public.leave_requests
  for each row execute function public.sync_leave_request_balance();

create or replace function public.get_my_leave_balances()
returns table (
  type text,
  allotted numeric,
  used numeric,
  pending numeric,
  available numeric,
  color text
) language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_employee_id uuid;
begin
  select p.org_id, public.current_employee_id()
    into v_org_id, v_employee_id
    from public.profiles p
    where p.id = auth.uid();

  if v_org_id is null or v_employee_id is null then
    return;
  end if;

  perform public.ensure_employee_leave_balances(v_org_id, v_employee_id);

  return query
    select
      lb.type,
      coalesce(lb.allotted, 0),
      coalesce(lb.used, 0),
      coalesce(lb.pending, 0),
      greatest(0, coalesce(lb.allotted, 0) - coalesce(lb.used, 0) - coalesce(lb.pending, 0)),
      lt.color
    from public.leave_balances lb
    left join public.leave_types lt on lt.org_id = lb.org_id and lower(lt.name) = lower(lb.type)
    where lb.org_id = v_org_id
      and lb.employee_id = v_employee_id
    order by lb.type;
end;
$$;

create or replace function public.apply_leave_request(
  p_type text,
  p_from_date date,
  p_to_date date,
  p_days numeric,
  p_half boolean default false,
  p_reason text default null,
  p_attachment text default null
)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
  v_employee public.employees%rowtype;
  v_balance public.leave_balances%rowtype;
  v_request public.leave_requests%rowtype;
  v_to_date date := coalesce(p_to_date, p_from_date);
  v_days numeric := coalesce(p_days, 0);
  v_available numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.org_id is null then
    raise exception 'Your profile is not linked to an organization.';
  end if;

  select e.*
    into v_employee
    from public.employees e
    where e.org_id = v_profile.org_id
      and (
        e.id = v_profile.employee_id
        or e.profile_id = v_profile.id
        or (v_profile.email is not null and lower(e.email) = lower(v_profile.email))
      )
    order by
      case
        when e.id = v_profile.employee_id then 0
        when e.profile_id = v_profile.id then 1
        else 2
      end,
      e.created_at
    limit 1;

  if not found then
    raise exception 'Your employee profile is not ready yet.';
  end if;

  update public.profiles
    set employee_id = v_employee.id
    where id = v_profile.id
      and employee_id is null;

  if p_type is null or length(trim(p_type)) = 0 then
    raise exception 'Choose a leave type.';
  end if;
  if p_from_date is null then
    raise exception 'Choose a start date.';
  end if;
  if v_to_date < p_from_date then
    raise exception 'End date cannot be before start date.';
  end if;
  if v_days <= 0 then
    raise exception 'Leave days must be greater than zero.';
  end if;

  perform public.ensure_employee_leave_balances(v_profile.org_id, v_employee.id);

  select *
    into v_balance
    from public.leave_balances
    where org_id = v_profile.org_id
      and employee_id = v_employee.id
      and lower(type) = lower(p_type)
    for update;

  if not found then
    raise exception 'Leave type "%" is not configured for your profile.', p_type;
  end if;

  v_available := greatest(0, coalesce(v_balance.allotted, 0) - coalesce(v_balance.used, 0) - coalesce(v_balance.pending, 0));
  if v_days > v_available then
    raise exception 'Not enough % leave balance. Available: %, requested: %.', v_balance.type, v_available, v_days;
  end if;

  insert into public.leave_requests (
    org_id, employee_id, emp, code, dept, type, from_date, to_date, days, half, reason, attachment, status, stage
  ) values (
    v_profile.org_id, v_employee.id, v_employee.name, v_employee.code, v_employee.dept,
    v_balance.type, p_from_date, case when coalesce(p_half, false) then p_from_date else v_to_date end,
    v_days, coalesce(p_half, false), nullif(trim(coalesce(p_reason, '')), ''), p_attachment, 'Pending', 'manager'
  )
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.decide_leave_request(p_request_id uuid, p_action text)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.leave_requests%rowtype;
  v_role public.user_role;
  v_patch_status public.leave_status;
  v_patch_stage public.leave_stage;
begin
  v_role := public.current_user_role();
  if v_role not in ('owner', 'hr', 'manager') then
    raise exception 'You do not have permission to decide leave requests.';
  end if;

  select *
    into v_request
    from public.leave_requests
    where id = p_request_id
      and org_id = public.current_org_id()
    for update;

  if not found then
    raise exception 'Leave request not found.';
  end if;

  if lower(p_action) = 'reject' then
    v_patch_status := 'Rejected';
    v_patch_stage := 'reject';
  elsif lower(p_action) = 'approve' and v_request.stage = 'manager' then
    v_patch_status := v_request.status;
    v_patch_stage := 'hr';
  elsif lower(p_action) = 'approve' then
    v_patch_status := 'Approved';
    v_patch_stage := 'done';
  else
    raise exception 'Unknown leave decision "%".', p_action;
  end if;

  update public.leave_requests
    set status = v_patch_status,
        stage = v_patch_stage,
        decided_by = auth.uid(),
        decided_at = now()
    where id = v_request.id
    returning * into v_request;

  return v_request;
end;
$$;

-- Backfill balance rows and recalculate current usage from request history.
do $$
declare
  r record;
begin
  for r in select org_id, id from public.employees loop
    perform public.ensure_employee_leave_balances(r.org_id, r.id);
  end loop;
end $$;

update public.leave_balances
  set used = 0,
      pending = 0,
      updated_at = now()
  where employee_id is not null;

with usage as (
  select
    org_id,
    employee_id,
    type,
    sum(case when status = 'Approved' then coalesce(days, 0) else 0 end) as used,
    sum(case when status = 'Pending' then coalesce(days, 0) else 0 end) as pending
  from public.leave_requests
  where employee_id is not null
    and status in ('Pending', 'Approved')
  group by org_id, employee_id, type
)
update public.leave_balances lb
  set used = usage.used,
      pending = usage.pending,
      updated_at = now()
  from usage
  where lb.org_id = usage.org_id
    and lb.employee_id = usage.employee_id
    and lower(lb.type) = lower(usage.type);

-- Balance and request reads are now scoped by login for employees, while
-- managers/admins retain the organization-level views they need.
drop policy if exists leave_balances_rw on public.leave_balances;
drop policy if exists leave_balances_select on public.leave_balances;
drop policy if exists leave_balances_admin_write on public.leave_balances;

create policy leave_balances_select on public.leave_balances
  for select using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr', 'manager')
      or employee_id = public.current_employee_id()
    )
  );

create policy leave_balances_admin_write on public.leave_balances
  for all using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());

drop policy if exists leave_select on public.leave_requests;
drop policy if exists leave_insert on public.leave_requests;
drop policy if exists leave_update on public.leave_requests;

create policy leave_select on public.leave_requests
  for select using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr', 'manager')
      or employee_id = public.current_employee_id()
      or (
        emp is not null
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and (
              lower(emp) = lower(coalesce(p.full_name, ''))
              or lower(emp) = lower(coalesce(p.email, ''))
            )
        )
      )
    )
  );

create policy leave_insert on public.leave_requests
  for insert with check (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr', 'manager')
      or employee_id = public.current_employee_id()
    )
  );

create policy leave_update on public.leave_requests
  for update using (
    org_id = public.current_org_id()
    and public.current_user_role() in ('owner', 'hr', 'manager')
  )
  with check (org_id = public.current_org_id());

revoke all on function public.ensure_employee_leave_balances(uuid, uuid) from anon, authenticated, public;
revoke all on function public.sync_leave_balances_for_employee() from anon, authenticated, public;
revoke all on function public.sync_leave_balances_for_leave_type() from anon, authenticated, public;
revoke all on function public.leave_balance_effect_total(public.leave_status, numeric) from anon, authenticated, public;
revoke all on function public.apply_leave_balance_delta(uuid, uuid, text, numeric, public.leave_status, integer, boolean) from anon, authenticated, public;
revoke all on function public.sync_leave_request_balance() from anon, authenticated, public;
grant execute on function public.get_my_leave_balances() to authenticated;
grant execute on function public.apply_leave_request(text, date, date, numeric, boolean, text, text) to authenticated;
grant execute on function public.decide_leave_request(uuid, text) to authenticated;
