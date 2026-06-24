-- Per-employee, per-cycle payroll adjustment (HR ± unpaid-leave days), so a pay
-- run's manual tweaks persist across sessions instead of living only in memory.
-- `cycle` is the run key 'YYYY-M:startDay' (year-monthIndex:cycleStartDay).
create table if not exists public.payroll_adjustments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle       text not null,
  adjust_days numeric not null default 0,
  updated_at  timestamptz not null default now(),
  unique (org_id, employee_id, cycle)
);
create index if not exists payroll_adjustments_org_cycle_idx on public.payroll_adjustments (org_id, cycle);

alter table public.payroll_adjustments enable row level security;

-- Scoped to the caller's org (same pattern as attendance/leave). The payroll
-- UI is gated to the "Run payroll" permission at the app layer.
drop policy if exists payroll_adj_rw on public.payroll_adjustments;
create policy payroll_adj_rw on public.payroll_adjustments
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
