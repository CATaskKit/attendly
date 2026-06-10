export type NetworkTimeResult = {
  at: Date;
  source: string;
};

export const APP_TIME_ZONE = 'Asia/Kolkata';

// A single, un-timed fetch to one provider was the old behaviour: when that
// provider was slow or rate-limited the request hung and the app silently fell
// back to the (untrusted) device clock. We now race through several sources,
// each with its own timeout, and stop at the first that answers.
const REQUEST_TIMEOUT_MS = 4000;

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
  // Epoch seconds (worldtimeapi `unixtime`) or milliseconds are unambiguous —
  // prefer them when present.
  const unixSeconds = payload.unixtime;
  if (typeof unixSeconds === 'number' && Number.isFinite(unixSeconds)) {
    const parsed = new Date(unixSeconds * 1000);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const raw =
    payload.utc_datetime ||       // worldtimeapi (already UTC, carries offset)
    payload.dateTime ||           // timeapi.io
    payload.datetime ||
    payload.currentDateTime ||    // worldclockapi
    payload.currentDateTimeOffset;

  if (typeof raw !== 'string' || !raw.trim()) return null;

  const zone = typeof payload.timeZone === 'string' ? payload.timeZone : '';
  const hasExplicitZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw);
  // If the string has no zone marker, attach one. timeapi.io returns the wall
  // clock for the requested zone, so an Asia/Kolkata payload gets +05:30;
  // anything else we assume is already UTC.
  const value = hasExplicitZone ? raw : `${raw}${zone === APP_TIME_ZONE ? '+05:30' : 'Z'}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// A JSON time API (timeapi.io / worldtimeapi style).
async function fetchJsonTime(url: string): Promise<Date> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as Record<string, unknown>;
  const at = parseTimePayload(payload);
  if (!at) throw new Error('invalid time payload');
  return at;
}

// Last-resort, near-guaranteed source: the HTTP `Date` header on our own page.
// It is same-origin, so the browser lets us read it (cross-origin `Date`
// headers are normally hidden), and any sane host (GitHub Pages, Vercel, etc.)
// stamps it with accurate UTC server time.
async function fetchDateHeaderTime(): Promise<Date> {
  const url = `${window.location.origin}${window.location.pathname}`;
  const res = await fetchWithTimeout(url, { method: 'HEAD' });
  const header = res.headers.get('date');
  if (!header) throw new Error('no Date header');
  const at = new Date(header);
  if (Number.isNaN(at.getTime())) throw new Error('invalid Date header');
  return at;
}

type TimeSource = { label: string; load: () => Promise<Date> };

function hostnameOf(url: string, fallback: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return fallback;
  }
}

const override = (import.meta.env.VITE_TIME_API_URL as string | undefined)?.trim();

// Tried in order; the first to answer wins. Internet sources come first so the
// clock is genuinely network-backed; the same-origin Date header anchors the
// chain so a slow/blocked API can't leave us stuck on the device clock.
const SOURCES: TimeSource[] = [
  ...(override ? [{ label: hostnameOf(override, 'online time'), load: () => fetchJsonTime(override) }] : []),
  {
    label: 'timeapi.io',
    load: () => fetchJsonTime('https://timeapi.io/api/time/current/zone?timeZone=Asia/Kolkata'),
  },
  {
    label: 'worldtimeapi.org',
    load: () => fetchJsonTime('https://worldtimeapi.org/api/timezone/Etc/UTC'),
  },
  {
    label: hostnameOf(typeof window !== 'undefined' ? window.location.href : '', 'server clock'),
    load: fetchDateHeaderTime,
  },
];

export async function fetchNetworkTime(): Promise<NetworkTimeResult> {
  let lastError: unknown = null;
  for (const source of SOURCES) {
    try {
      const at = await source.load();
      return { at, source: source.label };
    } catch (error) {
      lastError = error;
      // Try the next source.
    }
  }
  throw new Error(`Time sync failed across all sources: ${String(lastError)}`);
}
