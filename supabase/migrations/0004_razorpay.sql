-- Phase 4b: billing provider is Razorpay (annual, tiered per-seat).
-- Run after 0003_billing.sql. Adds Razorpay reference columns, a payment
-- history table, and extends the billing-column lock to the new columns.

alter table organizations add column if not exists razorpay_order_id   text;
alter table organizations add column if not exists razorpay_payment_id text;

-- Payment history (shown on the Billing tab). Only Edge Functions running with
-- the service_role key can write; org admins can read their own org's rows.
create table if not exists billing_payments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  provider     text not null default 'razorpay',
  order_id     text,
  payment_id   text unique,
  amount_inr   numeric not null,
  seats        integer not null,
  period_start timestamptz not null default now(),
  period_end   timestamptz not null,
  created_at   timestamptz not null default now()
);

alter table billing_payments enable row level security;
drop policy if exists billing_payments_select on billing_payments;
create policy billing_payments_select on billing_payments
  for select using (org_id = current_org_id() and is_admin());
-- No insert/update/delete policies on purpose: the service_role bypasses RLS.

-- Extend the lock so clients can't tamper with Razorpay columns either.
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
  end if;
  return NEW;
end $$;

drop trigger if exists trg_protect_org_billing on organizations;
create trigger trg_protect_org_billing before update on organizations
  for each row execute function public.protect_org_billing();
