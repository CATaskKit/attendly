export type NetworkTimeResult = {
  at: Date;
  source: string;
};

export const APP_TIME_ZONE = 'Asia/Kolkata';

const DEFAULT_TIME_URL = 'https://timeapi.io/api/time/current/zone?timeZone=Asia/Kolkata';
const TIME_URL = (import.meta.env.VITE_TIME_API_URL as string | undefined) || DEFAULT_TIME_URL;

export function formatAppDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseTimePayload(payload: Record<string, unknown>): Date | null {
  const raw =
    payload.dateTime ||
    payload.datetime ||
    payload.utc_datetime ||
    payload.currentDateTime ||
    payload.currentDateTimeOffset;

  if (typeof raw !== 'string' || !raw.trim()) return null;

  const zone = typeof payload.timeZone === 'string' ? payload.timeZone : '';
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const value = hasExplicitZone ? raw : `${raw}${zone === APP_TIME_ZONE ? '+05:30' : 'Z'}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function fetchNetworkTime(): Promise<NetworkTimeResult> {
  const res = await fetch(TIME_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Time sync failed (${res.status})`);
  const payload = await res.json() as Record<string, unknown>;
  const at = parseTimePayload(payload);
  if (!at) throw new Error('Time sync returned an invalid clock value');
  let source = 'online time';
  try {
    source = new URL(TIME_URL).hostname;
  } catch {
    source = 'online time';
  }
  return { at, source };
}
