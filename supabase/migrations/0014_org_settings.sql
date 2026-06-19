-- Move browser-local settings to the backend so they're shared org-wide.
-- employees.basic_salary: per-employee monthly basic for payroll (was localStorage).
-- organizations.settings: a JSON blob for the policy sections that have no
-- dedicated columns yet (roles grid, attendance policy, security, notification
-- preferences, standard shift). Not locked by protect_org_billing, so owner/HR
-- update it via the normal org-update RLS policy.
alter table employees      add column if not exists basic_salary numeric not null default 0;
alter table organizations  add column if not exists settings     jsonb   not null default '{}'::jsonb;
