-- ──────────────────────────────────────────────────────────────────────────
-- claim_invite()
--
-- Lets an authenticated user who isn't in an organization yet claim a matching
-- unclaimed employee invite by email (case-insensitive), linking the profile
-- and the employee record. This complements the signup-time linking in
-- migration 0006: it covers people who created their account *before* an admin
-- added them (e.g. signed in first), so the employee app can link them on the
-- next sign-in. Safe to call repeatedly — it no-ops once linked.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.claim_invite()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  current_org uuid;
  user_email text;
  invited record;
begin
  if uid is null then return null; end if;

  select org_id into current_org from public.profiles where id = uid;
  if current_org is not null then return current_org; end if;   -- already in an org

  select email into user_email from auth.users where id = uid;
  if user_email is null then return null; end if;

  select e.id as employee_id, e.org_id into invited
  from public.employees e
  where e.profile_id is null and e.email is not null
    and lower(e.email) = lower(user_email)
  order by e.created_at asc
  limit 1;

  if invited.employee_id is null then return null; end if;       -- no invite to claim

  update public.profiles
     set org_id = invited.org_id, role = 'employee', employee_id = invited.employee_id
   where id = uid;
  update public.employees set profile_id = uid where id = invited.employee_id;
  return invited.org_id;
end $$;

revoke all on function public.claim_invite() from anon, public;
grant execute on function public.claim_invite() to authenticated;
