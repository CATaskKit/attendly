-- Fix: the leave (0002) and reimbursement (0006) status-change notification
-- triggers call lower() / concatenate on an ENUM column (leave_status /
-- reimb_status). Postgres has no lower(enum) and won't implicitly cast enum→text,
-- so every approve/reject/pay UPDATE errored ("function lower(...) does not
-- exist") and rolled back. Cast the enum to text everywhere. Idempotent.

create or replace function public.notify_on_leave_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status and NEW.requested_by is not null then
    insert into notifications (org_id, user_id, type, title, body)
    values (NEW.org_id, NEW.requested_by, 'leave_' || lower(NEW.status::text),
            'Leave ' || NEW.status::text,
            'Your ' || NEW.type || ' leave was ' || lower(NEW.status::text) || '.');
  end if;
  return NEW;
end $$;

create or replace function public.notify_on_reimb_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status and NEW.profile_id is not null then
    insert into notifications (org_id, user_id, type, title, body)
    values (NEW.org_id, NEW.profile_id, 'reimbursement_' || lower(NEW.status::text),
            'Reimbursement ' || NEW.status::text,
            'Your ' || NEW.category || ' claim of ' || to_char(NEW.amount, 'FM999999990.00') || ' was ' || lower(NEW.status::text) ||
            case when NEW.status = 'Paid' and NEW.paid_ref is not null then ' (ref ' || NEW.paid_ref || ')' else '' end || '.');
  elsif NEW.stage = 'hr' and OLD.stage = 'manager' then
    insert into notifications (org_id, user_id, type, title, body)
    select NEW.org_id, p.id, 'reimbursement', 'Reimbursement awaiting HR',
           coalesce(NEW.emp, 'An employee') || '''s ' || NEW.category || ' claim was approved by their manager'
    from profiles p where p.org_id = NEW.org_id and p.role in ('owner', 'hr');
  end if;
  return NEW;
end $$;
