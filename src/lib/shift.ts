// Per-company shift timing + late-mark grace, persisted on the organizations row
// (migration 0013). Drives "late" detection in the Attendance MIS. Mirrors the
// shape of calendar.ts/weekendConfigFrom so the policy is read the same way.
export type ShiftPolicy = { start: string; end: string; graceMin: number };

// Defaults match the behaviour that was previously hardcoded in the MIS
// (late after 09:35 = 09:30 shift start + 5 min grace).
export const DEFAULT_SHIFT: ShiftPolicy = { start: '09:30', end: '18:30', graceMin: 5 };

/** Minutes-since-midnight for an 'HH:MM' string (safe fallback to 0). */
export function parseHm(value: string | null | undefined): number {
  const [h, m] = String(value ?? '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Minutes-since-midnight after which a check-in counts as late
 * (shift start + grace). Compare against `checkIn.getHours()*60 + getMinutes()`.
 */
export function lateThresholdMinutes(policy: ShiftPolicy = DEFAULT_SHIFT): number {
  return parseHm(policy.start) + Math.max(0, Number(policy.graceMin) || 0);
}

/** Read the shift policy off an organization-like row, with safe defaults. */
export function shiftPolicyFrom(
  o: { shift_start?: string | null; shift_end?: string | null; late_grace_min?: number | null } | null | undefined,
): ShiftPolicy {
  if (!o) return DEFAULT_SHIFT;
  return {
    start: o.shift_start || DEFAULT_SHIFT.start,
    end: o.shift_end || DEFAULT_SHIFT.end,
    graceMin: o.late_grace_min == null ? DEFAULT_SHIFT.graceMin : Number(o.late_grace_min),
  };
}
