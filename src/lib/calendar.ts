// Per-company weekend / week-off policy, used for working-day counts (payroll,
// attendance) and extra-day (comp-off) detection.
export type WeekendConfig = { weekendDays: number[]; satAlt: 'even' | 'odd' | null };
export const DEFAULT_WEEKEND: WeekendConfig = { weekendDays: [0, 6], satAlt: null };

/** True when a date is a company day-off (weekend). */
export function isOffDate(d: Date, cfg: WeekendConfig = DEFAULT_WEEKEND): boolean {
  const dow = d.getDay();
  if (dow === 6 && cfg.satAlt) {
    const ord = Math.ceil(d.getDate() / 7); // 1st..5th Saturday of the month
    return cfg.satAlt === 'even' ? ord === 2 || ord === 4 : ord === 1 || ord === 3 || ord === 5;
  }
  return cfg.weekendDays.includes(dow);
}

/** True when a 'YYYY-MM-DD' day string is a company day-off. */
export function isOffDay(day: string, cfg: WeekendConfig = DEFAULT_WEEKEND): boolean {
  return isOffDate(new Date(day + 'T00:00:00'), cfg);
}

/** Count working (non-off) days between two day-of-month numbers (inclusive). */
export function countWorkingDays(year: number, month: number, fromDay: number, toDay: number, cfg: WeekendConfig = DEFAULT_WEEKEND): number {
  let n = 0;
  for (let d = fromDay; d <= toDay; d++) if (!isOffDate(new Date(year, month, d), cfg)) n++;
  return n;
}

/** Read the weekend policy off an organization-like row, with safe defaults. */
export function weekendConfigFrom(o: { weekend_days?: number[] | null; weekend_sat_alt?: string | null } | null | undefined): WeekendConfig {
  if (!o) return DEFAULT_WEEKEND;
  const weekendDays = Array.isArray(o.weekend_days) && o.weekend_days.length ? o.weekend_days.map(Number) : DEFAULT_WEEKEND.weekendDays;
  const satAlt = o.weekend_sat_alt === 'even' || o.weekend_sat_alt === 'odd' ? o.weekend_sat_alt : null;
  return { weekendDays, satAlt };
}
