-- Per-company weekend / week-off policy. weekend_days = days of week that are
-- off (0=Sun .. 6=Sat); default Sun+Sat. weekend_sat_alt handles alternate
-- Saturdays: 'even' = 2nd & 4th Sat off, 'odd' = 1st/3rd/5th Sat off (when set,
-- Saturdays follow this rule instead of the plain weekend_days entry). Not
-- locked by protect_org_billing, so owner/HR can change it from Settings.
alter table organizations add column if not exists weekend_days    integer[] not null default '{0,6}';
alter table organizations add column if not exists weekend_sat_alt  text;
