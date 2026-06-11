-- Phase 4: per-seat subscription billing (Stripe).
-- Adds billing state to organizations and locks those columns so only the
-- Stripe webhook (running with the service_role key) can change them — an admin
-- can't self-upgrade by writing the row directly.

alter table organizations add column if not exists subscription_status text not null default 'trialing';
alter table organizations add column if not exists stripe_customer_id     text;
alter table organizations add column if not exists stripe_subscription_id text;
alter table organizations add column if not exists seats                  integer;
alter table organizations add column if not exists trial_ends_at          timestamptz default (now() + interval '14 days');
alter table organizations add column if not exists current_period_end     timestamptz;

-- Prevent clients from tampering with billing columns. The Stripe webhook uses
-- the service_role key (auth.role() = 'service_role') and is allowed through.
create or replace function public.protect_org_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    NEW.plan                   := OLD.plan;
    NEW.subscription_status    := OLD.subscription_status;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.seats                  := OLD.seats;
    NEW.trial_ends_at          := OLD.trial_ends_at;
    NEW.current_period_end     := OLD.current_period_end;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_protect_org_billing on organizations;
create trigger trg_protect_org_billing before update on organizations
  for each row execute function public.protect_org_billing();
