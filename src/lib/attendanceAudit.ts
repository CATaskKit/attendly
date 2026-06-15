export type LocationError = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | null;

export type AttendanceAudit = {
  location: string | null;
  locationError?: LocationError;
  ip: string | null;
  device: string;
};

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

export async function getLocation(): Promise<{ label: string | null; error: LocationError }> {
  if (!navigator.geolocation) return { label: null, error: 'unsupported' };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({ label: `${roundCoord(latitude)}, ${roundCoord(longitude)} (±${Math.round(accuracy)} m)`, error: null });
      },
      (err) => resolve({ label: null, error: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export async function getLocationLabel(): Promise<string | null> {
  return (await getLocation()).label;
}

export async function collectAttendanceAudit(): Promise<AttendanceAudit> {
  const [loc, ip] = await Promise.all([getLocation(), getNetworkIp()]);
  return { location: loc.label, locationError: loc.error, ip, device: getDeviceInfo() };
}