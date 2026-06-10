-- Phase 3: server-side notifications for leave events.
-- Run after 0001_init.sql. Adds requested_by to leave_requests and triggers
-- that create rows in `notifications` (which is already realtime-enabled), so
-- approvers and employees get live in-app alerts.

-- Who raised the request (defaults to the inserting user).
alter table leave_requests add column if not exists requested_by uuid references profiles (id) default auth.uid();

-- New request → notify the org's approvers (owner / hr / manager), not the requester.
create or replace function public.notify_on_leave_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (org_id, user_id, type, title, body)
  select NEW.org_id, p.id, 'leave_request',
         'New leave request',
         coalesce(NEW.emp, 'An employee') || ' requested ' || NEW.type || ' (' || NEW.days || 'd)'
  from profiles p
  where p.org_id = NEW.org_id
    and p.role in ('owner', 'hr', 'manager')
    and p.id <> coalesce(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid);
  return NEW;
end $$;

-- Status change → notify the employee who requested it.
create or replace function public.notify_on_leave_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status and NEW.requested_by is not null then
    insert into notifications (org_id, user_id, type, title, body)
    values (NEW.org_id, NEW.requested_by, 'leave_' || lower(NEW.status),
            'Leave ' || NEW.status,
            'Your ' || NEW.type || ' leave was ' || lower(NEW.status) || '.');
  end if;
  return NEW;
end $$;

drop trigger if exists trg_leave_insert_notify on leave_requests;
create trigger trg_leave_insert_notify after insert on leave_requests
  for each row execute function public.notify_on_leave_insert();

drop trigger if exists trg_leave_update_notify on leave_requests;
create trigger trg_leave_update_notify after update on leave_requests
  for each row execute function public.notify_on_leave_update();
