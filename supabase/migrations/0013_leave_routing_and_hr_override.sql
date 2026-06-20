-- ──────────────────────────────────────────────────────────────────────────
-- Leave routing fix + HR override
--
-- Problem: apply_leave_request always inserts new requests at stage 'manager'.
-- If the employee has no manager (or their "reporting to" person isn't a
-- role='manager' user), the request gets stuck — no one can approve it at the
-- manager stage, and HR is blocked with "Manager approval is required".
--
-- Fix 1: a BEFORE INSERT trigger routes a new request to 'hr' instead of
--        'manager' when there is no real approving manager for that employee.
-- Fix 2: redefine decide_leave_request so owner/HR can approve or reject a
--        request at ANY stage (override a manager who hasn't acted), while a
--        manager can still only forward their own team's manager-stage requests.
-- ──────────────────────────────────────────────────────────────────────────

-- Fix 1 — initial stage routing -------------------------------------------------
create or replace function public.route_leave_stage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  emp_manager text;
  has_manager boolean;
begin
  -- Only adjust freshly-applied manager-stage requests.
  if new.stage <> 'manager' or new.status <> 'Pending' then
    return new;
  end if;

  select e.manager into emp_manager from public.employees e where e.id = new.employee_id;

  if emp_manager is null or length(trim(emp_manager)) = 0 then
    new.stage := 'hr';            -- no reporting manager → straight to HR
    return new;
  end if;

  select exists (
    select 1
    from public.profiles mp
    left join public.employees me on me.id = mp.employee_id or me.profile_id = mp.id
    where mp.org_id = new.org_id
      and mp.role = 'manager'
      and (
        lower(coalesce(me.name, '')) = lower(emp_manager)
        or lower(coalesce(mp.full_name, '')) = lower(emp_manager)
        or lower(coalesce(mp.email, '')) = lower(emp_manager)
      )
  ) into has_manager;

  if not has_manager then
    new.stage := 'hr';            -- "reporting to" isn't a real manager → HR
  end if;
  return new;
end $$;

drop trigger if exists route_leave_stage_trg on public.leave_requests;
create trigger route_leave_stage_trg
  before insert on public.leave_requests
  for each row execute function public.route_leave_stage();

-- Fix 2 — HR/owner can decide any stage ----------------------------------------
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

  select * into v_request
    from public.leave_requests
    where id = p_request_id and org_id = public.current_org_id()
    for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;
  if v_request.status <> 'Pending' then
    raise exception 'This leave request is already %.', v_request.status;
  end if;

  -- A manager may only act on their own team's manager-stage requests.
  if v_role = 'manager' then
    if not public.is_my_team_member(v_request.employee_id) then
      raise exception 'Managers can approve only their own team members.';
    end if;
    if v_request.stage <> 'manager' then
      raise exception 'This leave request is already with HR.';
    end if;
  end if;

  if v_action = 'reject' then
    v_patch_status := 'Rejected';
    v_patch_stage := 'reject';
  elsif v_role = 'manager' then
    -- Manager approval forwards to HR for the final decision.
    v_patch_status := v_request.status;   -- stays Pending
    v_patch_stage := 'hr';
  else
    -- Owner/HR approval is final at any stage (overrides a pending manager).
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
end $$;

grant execute on function public.decide_leave_request(uuid, text) to authenticated;
