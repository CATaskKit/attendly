-- Manager-only team leave approvals.
-- Managers can see and decide only leave requests from their direct reports.

create or replace function public.is_my_team_member(p_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with me as (
    select
      p.org_id,
      p.full_name,
      p.email,
      p.role,
      e.id as manager_employee_id,
      e.name as manager_name
    from public.profiles p
    left join public.employees e on e.id = public.current_employee_id()
    where p.id = auth.uid()
  )
  select coalesce((
    select
      m.role = 'manager'
      and target.org_id = m.org_id
      and target.id is distinct from m.manager_employee_id
      and lower(coalesce(target.manager, '')) = any (
        array_remove(array[
          lower(coalesce(m.manager_name, '')),
          lower(coalesce(m.full_name, '')),
          lower(coalesce(m.email, ''))
        ], '')
      )
    from me m
    join public.employees target on target.id = p_employee_id
  ), false);
$$;

create or replace function public.get_my_team_leave_requests()
returns setof public.leave_requests language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'manager' then
    return;
  end if;

  return query
    select lr.*
    from public.leave_requests lr
    join public.employees e on e.id = lr.employee_id
    where lr.org_id = public.current_org_id()
      and public.is_my_team_member(e.id)
    order by
      case
        when lr.status = 'Pending' and lr.stage = 'manager' then 0
        when lr.status = 'Pending' then 1
        else 2
      end,
      lr.applied_at desc;
end;
$$;

create or replace function public.decide_team_leave_request(p_request_id uuid, p_action text)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.leave_requests%rowtype;
  v_action text := lower(coalesce(p_action, ''));
begin
  if public.current_user_role() <> 'manager' then
    raise exception 'Only managers can approve team leave requests.';
  end if;

  if v_action not in ('approve', 'reject') then
    raise exception 'Unknown leave decision "%".', p_action;
  end if;

  select lr.*
    into v_request
    from public.leave_requests lr
    join public.employees e on e.id = lr.employee_id
    where lr.id = p_request_id
      and lr.org_id = public.current_org_id()
      and public.is_my_team_member(e.id)
    for update of lr;

  if not found then
    raise exception 'Leave request not found for your team.';
  end if;

  if v_request.status <> 'Pending' then
    raise exception 'This leave request is already %.', v_request.status;
  end if;

  if v_request.stage <> 'manager' then
    raise exception 'This leave request is already with HR.';
  end if;

  update public.leave_requests
    set status = case when v_action = 'reject' then 'Rejected'::public.leave_status else status end,
        stage = case when v_action = 'reject' then 'reject'::public.leave_stage else 'hr'::public.leave_stage end,
        decided_by = auth.uid(),
        decided_at = now()
    where id = v_request.id
    returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.decide_leave_request(p_request_id uuid, p_action text)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.leave_requests%rowtype;
  v_role public.user_role;
  v_action text := lower(coalesce(p_action, ''));
  v_patch_status public.leave_status;
  v_patch_stage public.leave_stage;
begin
  v_role := public.current_user_role();
  if v_role not in ('owner', 'hr', 'manager') then
    raise exception 'You do not have permission to decide leave requests.';
  end if;

  if v_action not in ('approve', 'reject') then
    raise exception 'Unknown leave decision "%".', p_action;
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

  if v_request.status <> 'Pending' then
    raise exception 'This leave request is already %.', v_request.status;
  end if;

  if v_role = 'manager' then
    if not public.is_my_team_member(v_request.employee_id) then
      raise exception 'Managers can approve only their own team members.';
    end if;
    if v_request.stage <> 'manager' then
      raise exception 'This leave request is already with HR.';
    end if;
  elsif v_action = 'approve' and v_request.stage = 'manager' then
    raise exception 'Manager approval is required before HR approval.';
  end if;

  if v_action = 'reject' then
    v_patch_status := 'Rejected';
    v_patch_stage := 'reject';
  elsif v_request.stage = 'manager' then
    v_patch_status := v_request.status;
    v_patch_stage := 'hr';
  else
    v_patch_status := 'Approved';
    v_patch_stage := 'done';
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

drop policy if exists leave_balances_select on public.leave_balances;
create policy leave_balances_select on public.leave_balances
  for select using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr')
      or employee_id = public.current_employee_id()
      or public.is_my_team_member(employee_id)
    )
  );

drop policy if exists leave_select on public.leave_requests;
drop policy if exists leave_insert on public.leave_requests;
drop policy if exists leave_update on public.leave_requests;

create policy leave_select on public.leave_requests
  for select using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr')
      or employee_id = public.current_employee_id()
      or public.is_my_team_member(employee_id)
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
      public.current_user_role() in ('owner', 'hr')
      or employee_id = public.current_employee_id()
    )
  );

create policy leave_update on public.leave_requests
  for update using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() in ('owner', 'hr')
      or public.is_my_team_member(employee_id)
    )
  )
  with check (org_id = public.current_org_id());

grant execute on function public.is_my_team_member(uuid) to authenticated;
grant execute on function public.get_my_team_leave_requests() to authenticated;
grant execute on function public.decide_team_leave_request(uuid, text) to authenticated;
grant execute on function public.decide_leave_request(uuid, text) to authenticated;
