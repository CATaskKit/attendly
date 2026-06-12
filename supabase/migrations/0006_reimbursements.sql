-- Reimbursement / convenience claims. Employees submit expense claims with
-- receipt attachments; they route (optionally via the employee's manager) to
-- HR for approval and payment. Gated by a paid add-on (organizations
-- .reimbursement_enabled, set only by the billing Edge Functions). Run after
-- 0005_billing_period.sql.

-- ── Org flags ─────────────────────────────────────────────────────────
-- reimbursement_enabled: paid add-on switch (locked like the billing columns).
-- reimbursement_require_manager: a free per-company setting admins can toggle.
alter table organizations add column if not exists reimbursement_enabled         boolean not null default false;
alter table organizations add column if not exists reimbursement_require_manager  boolean not null default true;

-- Extend the billing-column lock so clients can't self-enable the paid add-on.
create or replace function public.protect_org_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    NEW.plan                   := OLD.plan;
    NEW.subscription_status    := OLD.subscription_status;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.razorpay_order_id      := OLD.razorpay_order_id;
    NEW.razorpay_payment_id    := OLD.razorpay_payment_id;
    NEW.seats                  := OLD.seats;
    NEW.trial_ends_at          := OLD.trial_ends_at;
    NEW.current_period_end     := OLD.current_period_end;
    NEW.reimbursement_enabled  := OLD.reimbursement_enabled;
    -- NOTE: reimbursement_require_manager is intentionally NOT locked.
  end if;
  return NEW;
end $$;

drop trigger if exists trg_protect_org_billing on organizations;
create trigger trg_protect_org_billing before update on organizations
  for each row execute function public.protect_org_billing();

-- ── Claims table ──────────────────────────────────────────────────────
do $$ begin
  create type reimb_status as enum ('Pending', 'Approved', 'Rejected', 'Paid');
exception when duplicate_object then null; end $$;

create table if not exists reimbursements (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations (id) on delete cascade,
  employee_id        uuid references employees (id) on delete set null,
  profile_id         uuid references profiles (id) on delete set null default auth.uid(),
  emp                text,
  code               text,
  dept               text,
  category           text not null default 'General',
  amount             numeric not null,
  spent_on           date not null default current_date,
  reason             text,
  attachments        jsonb not null default '[]',   -- [{path,name,size}]
  status             reimb_status not null default 'Pending',
  stage              leave_stage not null default 'hr',
  manager_decided_by uuid references profiles (id),
  hr_decided_by      uuid references profiles (id),
  paid_by            uuid references profiles (id),
  paid_at            timestamptz,
  paid_ref           text,
  created_at         timestamptz not null default now()
);
create index if not exists reimbursements_org_idx on reimbursements (org_id);
create index if not exists reimbursements_profile_idx on reimbursements (profile_id);

alter table reimbursements enable row level security;
-- Org-scoped, mirroring leave_requests (app enforces who does what).
drop policy if exists reimb_select on reimbursements;
create policy reimb_select on reimbursements for select using (org_id = current_org_id());
drop policy if exists reimb_insert on reimbursements;
create policy reimb_insert on reimbursements for insert with check (org_id = current_org_id());
drop policy if exists reimb_update on reimbursements;
create policy reimb_update on reimbursements for update using (org_id = current_org_id());

-- ── Receipt storage (private bucket, org-scoped paths <org_id>/<uid>/<file>) ──
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = current_org_id()::text);
drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = current_org_id()::text);

-- ── Notifications (mirror 0002): new claim → approvers; status change → owner ──
create or replace function public.notify_on_reimb_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (org_id, user_id, type, title, body)
  select NEW.org_id, p.id, 'reimbursement',
         'New reimbursement claim',
         coalesce(NEW.emp, 'An employee') || ' claimed ' || to_char(NEW.amount, 'FM999999990.00') || ' for ' || NEW.category
  from profiles p
  where p.org_id = NEW.org_id
    and ((NEW.stage = 'manager' and p.role = 'manager') or (NEW.stage = 'hr' and p.role in ('owner', 'hr')))
    and p.id <> coalesce(NEW.profile_id, '00000000-0000-0000-0000-000000000000'::uuid);
  return NEW;
end $$;

create or replace function public.notify_on_reimb_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status and NEW.profile_id is not null then
    insert into notifications (org_id, user_id, type, title, body)
    values (NEW.org_id, NEW.profile_id, 'reimbursement_' || lower(NEW.status),
            'Reimbursement ' || NEW.status,
            'Your ' || NEW.category || ' claim of ' || to_char(NEW.amount, 'FM999999990.00') || ' was ' || lower(NEW.status) ||
            case when NEW.status = 'Paid' and NEW.paid_ref is not null then ' (ref ' || NEW.paid_ref || ')' else '' end || '.');
  -- Manager forwarded it to HR → let HR know there's something to action.
  elsif NEW.stage = 'hr' and OLD.stage = 'manager' then
    insert into notifications (org_id, user_id, type, title, body)
    select NEW.org_id, p.id, 'reimbursement', 'Reimbursement awaiting HR',
           coalesce(NEW.emp, 'An employee') || '''s ' || NEW.category || ' claim was approved by their manager'
    from profiles p where p.org_id = NEW.org_id and p.role in ('owner', 'hr');
  end if;
  return NEW;
end $$;

drop trigger if exists trg_reimb_insert_notify on reimbursements;
create trigger trg_reimb_insert_notify after insert on reimbursements
  for each row execute function public.notify_on_reimb_insert();

drop trigger if exists trg_reimb_update_notify on reimbursements;
create trigger trg_reimb_update_notify after update on reimbursements
  for each row execute function public.notify_on_reimb_update();

-- ── Realtime ──────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table reimbursements;
exception when others then null; end $$;
