-- ──────────────────────────────────────────────────────────────────────────
-- Employee invite linking
--
-- People added during onboarding (or later from the admin console) are stored
-- as `employees` rows with an email but no auth account yet. When such a person
-- signs up with that same email, this links them automatically: their new
-- profile is placed in the inviting organization as an `employee`, and the
-- employee record is bound to the new auth user. No service_role / server code
-- needed — the match happens inside the existing new-user trigger.
--
-- Owners are unaffected: a brand-new owner matches no employee row, so their
-- profile is created org-less and `create_organization` assigns the org as
-- before.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invited record;
begin
  -- An unclaimed employee invited with this email (case-insensitive).
  select e.id as employee_id, e.org_id
    into invited
  from public.employees e
  where e.profile_id is null
    and e.email is not null
    and lower(e.email) = lower(new.email)
  order by e.created_at asc
  limit 1;

  insert into public.profiles (id, email, full_name, org_id, role, employee_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    invited.org_id,            -- null when no invite matched
    'employee',
    invited.employee_id        -- null when no invite matched
  )
  on conflict (id) do nothing;

  -- Bind the employee record to this new auth user so the admin console shows
  -- them as active and the employee app loads their org data.
  if invited.employee_id is not null then
    update public.employees set profile_id = new.id where id = invited.employee_id;
  end if;

  return new;
end $$;

-- Trigger already exists (created in 0001); redefining the function is enough.
