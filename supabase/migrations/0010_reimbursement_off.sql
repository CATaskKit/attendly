-- Let an owner/HR turn the reimbursement add-on OFF (they no longer want it).
-- This is an admin preference, separate from the paid entitlement
-- (reimbursement_enabled): a paid org can switch it off to hide every
-- reimbursement feature, then back on (free, within the paid period). NOT
-- locked by protect_org_billing, so admins can toggle it via updateOrganization.
alter table organizations add column if not exists reimbursement_disabled boolean not null default false;
