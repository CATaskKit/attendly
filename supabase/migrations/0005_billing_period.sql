-- Phase 4c: every org gets a 1-year period from onboarding (no 14-day trial).
-- Up to 5 employees is free for that year and renews free; above 5 is paid
-- (prorated into the open period). Run after 0004_razorpay.sql.

-- New orgs: free, with a 1-year period that starts the moment the row is
-- inserted. The billing-lock trigger only guards UPDATEs, so these INSERT
-- defaults apply normally at onboarding.
alter table organizations alter column subscription_status set default 'free';
alter table organizations alter column plan                set default 'free';
alter table organizations alter column current_period_end  set default (now() + interval '1 year');
-- trial_ends_at is retired as a gate; keep it mirroring the period for back-compat.
alter table organizations alter column trial_ends_at        set default (now() + interval '1 year');

-- Backfill existing orgs. The protect_org_billing trigger would reset these
-- columns for a non-service_role writer (the SQL editor has no JWT), so disable
-- it just for this migration.
alter table organizations disable trigger trg_protect_org_billing;

update organizations
set current_period_end = coalesce(current_period_end, created_at + interval '1 year', now() + interval '1 year'),
    trial_ends_at      = coalesce(current_period_end, created_at + interval '1 year', now() + interval '1 year'),
    subscription_status = case when subscription_status in ('trialing', 'trial', '') or subscription_status is null
                               then 'free' else subscription_status end,
    plan = case when subscription_status = 'active' then 'growth' else 'free' end;

alter table organizations enable trigger trg_protect_org_billing;
