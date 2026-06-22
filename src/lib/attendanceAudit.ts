import { Capacitor } from '@capacitor/core';

export type LocationError = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | null;

export type AttendanceAudit = {
  location: string | null;
  locationError?: LocationError;
  lat?: number | null;
  lng?: number | null;
  ip: string | null;
  device: string;
};

/** Great-circle distance in metres between two lat/lng points (haversine). */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// A user-facing prompt explaining how to fix a missing location.
export function locationMessage(error: LocationError): string {
  switch (error) {
    case 'denied': return 'Location is off. Turn on location access for this site, then try again.';
    case 'unsupported': return "This device can't share a location.";
    case 'timeout': return "Couldn't get your location in time. Keep location on and retry.";
    default: return 'Turn on location to check in, then try again.';
  }
}

const IP_LOOKUP_URL = (import.meta.env.VITE_IP_LOOKUP_URL as string | undefined) || 'https://api.ipify.org?format=json';

function roundCoord(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function getBrowserName(userAgent: string) {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/Chrome\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  return 'Browser';
}

export function getDeviceInfo(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean; brands?: Array<{ brand: string; version: string }> } };
  const ua = navigator.userAgent;
  const platform = nav.userAgentData?.platform || navigator.platform || 'Unknown platform';
  const browser = nav.userAgentData?.brands?.find((b) => !/Not|Chromium/i.test(b.brand))?.brand || getBrowserName(ua);
  const mode = nav.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/i.test(ua) ? 'Mobile' : 'Desktop';
  return `${browser} on ${platform} (${mode})`;
}

export async function getNetworkIp(): Promise<string | null> {
  try {
    const res = await fetch(IP_LOOKUP_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json() as { ip?: string; query?: string; address?: string };
      return data.ip || data.query || data.address || null;
    }
    const text = (await res.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}

function fmtCoords(latitude: number, longitude: number): string {
  return `${roundCoord(latitude)}, ${roundCoord(longitude)}`;
}

// Reverse-geocode lat/lng → a human place name ("Indiranagar, Bengaluru,
// Karnataka"). Uses BigDataCloud's free, key-less, CORS-enabled client endpoint.
// Best-effort with a short timeout; returns null on any failure.
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { cache: 'no-store', signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string; countryName?: string };
    const parts = [d.locality, d.city, d.principalSubdivision]
      .map((x) => (x || '').trim())
      .filter(Boolean);
    const name = Array.from(new Set(parts)).join(', ');
    return name || null;
  } catch {
    return null;
  }
}

// Builds the stored/displayed label: place name + coords when a name is found,
// else coords + accuracy.
async function buildLocationLabel(lat: number, lng: number, accuracy: number): Promise<string> {
  const name = await reverseGeocode(lat, lng);
  return name ? `${name} · ${fmtCoords(lat, lng)}` : `${fmtCoords(lat, lng)} (±${Math.round(accuracy)} m)`;
}

export type LocationResult = { label: string | null; error: LocationError; lat: number | null; lng: number | null };

export async function getLocation(): Promise<LocationResult> {
  let coords: { lat: number; lng: number; accuracy: number } | null = null;

  if (Capacitor.isNativePlatform()) {
    // Native (Capacitor): use the Geolocation plugin so Android runtime location
    // permissions are requested properly inside the installed app.
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions();
      }
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        return { label: null, error: 'denied', lat: null, lng: null };
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0 };
    } catch {
      return { label: null, error: 'unavailable', lat: null, lng: null };
    }
  } else {
    // Web: the standard geolocation API (HTTPS + the browser's permission prompt).
    if (!navigator.geolocation) return { label: null, error: 'unsupported', lat: null, lng: null };
    const r = await new Promise<{ lat: number; lng: number; accuracy: number } | { error: LocationError }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => resolve({ error: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable' }),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
    if ('error' in r) return { label: null, error: r.error, lat: null, lng: null };
    coords = r;
  }

  const label = await buildLocationLabel(coords.lat, coords.lng, coords.accuracy);
  return { label, error: null, lat: coords.lat, lng: coords.lng };
}

export async function getLocationLabel(): Promise<string | null> {
  return (await getLocation()).label;
}

export async function collectAttendanceAudit(): Promise<AttendanceAudit> {
  const [loc, ip] = await Promise.all([getLocation(), getNetworkIp()]);
  return { location: loc.label, locationError: loc.error, lat: loc.lat, lng: loc.lng, ip, device: getDeviceInfo() };
}