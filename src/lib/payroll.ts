// Payroll cycle + policy helpers. A company decides (a) when its pay cycle
// starts (1 = calendar month; N = Nth..(N-1) next month) and (b) whether the
// per-day rate divides the salary by CALENDAR days or WORKING days of the
// cycle. Weekends come from the org weekend policy (calendar.ts) and holidays
// from the holidays table. Deductions are driven only by UNPAID leave (+ an
// optional HR adjustment), never by ordinary attendance gaps.
import { isOffDate, type WeekendConfig } from './calendar';

export type DayBasis = 'calendar' | 'working';
export type PayrollPolicy = { cycleStartDay: number; dayBasis: DayBasis };
export const DEFAULT_PAYROLL: PayrollPolicy = { cycleStartDay: 1, dayBasis: 'calendar' };

/** Read the payroll policy off the org settings JSON, with safe defaults. */
export function payrollPolicyFrom(settings: Record<string, unknown> | null | undefined): PayrollPolicy {
  const p = (settings?.payrollPolicy ?? {}) as Partial<PayrollPolicy>;
  // Cap the start day at 28 so the cycle boundary exists in every month (incl. Feb).
  const cycleStartDay = Math.min(28, Math.max(1, Math.round(Number(p.cycleStartDay)) || 1));
  const dayBasis: DayBasis = p.dayBasis === 'working' ? 'working' : 'calendar';
  return { cycleStartDay, dayBasis };
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type CycleRange = { start: Date; end: Date; startISO: string; endISO: string; calendarDays: number; label: string };

/**
 * The pay cycle for a selected (year, monthIndex). With startDay=1 it's the
 * whole calendar month; otherwise it runs from startDay of that month to the
 * day before startDay of the next month (e.g. 26 Jun → 25 Jul).
 */
export function cycleRange(year: number, monthIndex: number, startDay: number): CycleRange {
  const start = new Date(year, monthIndex, startDay);
  const end = startDay === 1
    ? new Date(year, monthIndex + 1, 0)              // last day of this month
    : new Date(year, monthIndex + 1, startDay - 1);  // day before startDay next month
  const calendarDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const label = startDay === 1
    ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : `${fmt(start)} – ${fmt(end)}`;
  return { start, end, startISO: isoDate(start), endISO: isoDate(end), calendarDays, label };
}

/** Working days in [start,end] = days that are neither a company day-off nor a holiday. */
export function workingDaysInRange(start: Date, end: Date, cfg: WeekendConfig, holidays: Set<string>): number {
  return cycleBreakdown(start, end, cfg, holidays).working;
}

/**
 * One pass over the cycle splitting it into weekends (company days-off),
 * compulsory holidays (counted only on days that aren't already a weekend) and
 * working days. `working = calendar − weekends − holidays`, so it's transparent
 * how the working-day count was reached.
 */
export function cycleBreakdown(start: Date, end: Date, cfg: WeekendConfig, holidays: Set<string>): { weekends: number; holidays: number; working: number } {
  let weekends = 0, hol = 0, working = 0;
  const d = new Date(start);
  while (d <= end) {
    if (isOffDate(d, cfg)) weekends++;
    else if (holidays.has(isoDate(d))) hol++;
    else working++;
    d.setDate(d.getDate() + 1);
  }
  return { weekends, holidays: hol, working };
}

/** A leave type that loses pay. Org leave-type names vary, so match common ones. */
export function isUnpaidLeave(type: string | null | undefined): boolean {
  const t = (type ?? '').toLowerCase().trim();
  return t.includes('unpaid') || t.includes('without pay') || t.includes('loss of pay') || t === 'lwp' || t === 'lop';
}

/**
 * Days of one leave that fall inside the cycle. If the leave sits entirely in
 * the cycle we trust its recorded `days` (honours half-days); if it straddles a
 * boundary we prorate by the overlapping calendar days.
 */
export function leaveDaysInCycle(fromISO: string | null, toISO: string | null, days: number, c: CycleRange): number {
  if (!fromISO) return 0;
  const from = fromISO;
  const to = toISO || fromISO;
  if (to < c.startISO || from > c.endISO) return 0;          // no overlap
  if (from >= c.startISO && to <= c.endISO) return Number(days || 0); // fully inside
  const lo = from > c.startISO ? from : c.startISO;
  const hi = to < c.endISO ? to : c.endISO;
  return Math.round((new Date(hi + 'T00:00:00').getTime() - new Date(lo + 'T00:00:00').getTime()) / 86400000) + 1;
}
