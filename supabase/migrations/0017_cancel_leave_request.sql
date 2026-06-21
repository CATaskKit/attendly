-- ──────────────────────────────────────────────────────────────────────────
-- Fix: employees can't cancel their own leave.
--
-- The leave_update RLS policy only lets owner/HR or the team manager update a
-- request — not the requester. So an employee tapping "Cancel request" updated
-- 0 rows (RLS filtered it out) and nothing happened. The balance restore would
-- fail the same way. This RPC (security definer) lets the requester withdraw
-- their own pending request (and owner/HR cancel any), releasing the pending
-- balance hold in one trusted call.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.cancel_leave_request(p_id uuid)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_request public.leave_requests%rowtype;
  v_emp uuid := public.current_employee_id();
  v_role public.user_role := public.current_user_role();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_request
    from public.leave_requests
    where id = p_id and org_id = public.current_org_id()
    for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;

  -- The requester may withdraw their own request; owner/HR may cancel any.
  if not (v_role in ('owner', 'hr') or v_request.employee_id = v_emp) then
    raise exception 'You can only withdraw your own leave requests.';
  end if;
  if v_request.status <> 'Pending' then
    raise exception 'Only pending requests can be withdrawn.';
  end if;

  update public.leave_requests
    set status = 'Cancelled', stage = 'reject', decided_by = auth.uid(), decided_at = now()
    where id = v_request.id
    returning * into v_request;

  -- Release the pending hold on the leave balance (comp-off has no row → no-op).
  update public.leave_balances
    set pending = greatest(0, coalesce(pending, 0) - coalesce(v_request.days, 0))
    where org_id = v_request.org_id
      and employee_id = v_request.employee_id
      and lower(type) = lower(v_request.type);

  return v_request;
end $$;

revoke all on function public.cancel_leave_request(uuid) from anon, public;
grant execute on function public.cancel_leave_request(uuid) to authenticated;
