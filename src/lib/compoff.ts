// Comp-off (compensatory off) is fully derived — no per-credit table:
// an attendance day that falls on a company day-off (weekend per the org's
// policy) or a holiday is an "extra work day" and earns one comp-off credit.
// The employee can later take a "Comp off" leave drawing from the earned
// balance, and HR can optionally pay the extra days out as overtime in payroll.
import { isOffDay, DEFAULT_WEEKEND, type WeekendConfig } from './calendar';

export const COMP_OFF_TYPE = 'Comp off';

/** True when an attendance day is a holiday or a company day-off → earns comp-off. */
export function isExtraWorkDay(day: string, holidayDates: Set<string>, cfg: WeekendConfig = DEFAULT_WEEKEND): boolean {
  return holidayDates.has(day) || isOffDay(day, cfg);
}

/** Distinct extra-work days from a list of attendance day strings. */
export function countExtraDays(days: Iterable<string>, holidayDates: Set<string>, cfg: WeekendConfig = DEFAULT_WEEKEND): number {
  const seen = new Set<string>();
  for (const d of days) if (d && isExtraWorkDay(d, holidayDates, cfg)) seen.add(d);
  return seen.size;
}
