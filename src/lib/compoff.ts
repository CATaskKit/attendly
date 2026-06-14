// Comp-off (compensatory off) is fully derived — no schema change:
// an attendance day that falls on a weekend (Sat/Sun) or a company holiday is an
// "extra work day" and earns one comp-off credit. The employee can later take a
// "Comp off" leave that draws from the earned balance, and HR can optionally pay
// the extra days out as overtime in payroll.
export const COMP_OFF_TYPE = 'Comp off';
const WEEKEND = new Set([0, 6]); // Sun, Sat — matches the payroll working-day logic

/** True when an attendance day is a weekend or a holiday → earns comp-off. */
export function isExtraWorkDay(day: string, holidayDates: Set<string>): boolean {
  if (holidayDates.has(day)) return true;
  return WEEKEND.has(new Date(day + 'T00:00:00').getDay());
}

/** Distinct extra-work days from a list of attendance day strings. */
export function countExtraDays(days: Iterable<string>, holidayDates: Set<string>): number {
  const seen = new Set<string>();
  for (const d of days) if (d && isExtraWorkDay(d, holidayDates)) seen.add(d);
  return seen.size;
}
