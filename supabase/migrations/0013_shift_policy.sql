-- Per-company shift timing + late-mark grace. Used by Attendance MIS to decide
-- which check-ins are "late": a check-in after (shift_start + late_grace_min) is
-- late. shift_start / shift_end are wall-clock 'HH:MM' strings in the org's
-- timezone. Defaults preserve the previous hardcoded behaviour (late after
-- 09:35 = 09:30 shift + 5 min grace). Not locked by protect_org_billing, so
-- owner/HR can change them from Settings → Work week (same as weekend_config).
alter table organizations add column if not exists shift_start    text    not null default '09:30';
alter table organizations add column if not exists shift_end      text    not null default '18:30';
alter table organizations add column if not exists late_grace_min integer not null default 5;
