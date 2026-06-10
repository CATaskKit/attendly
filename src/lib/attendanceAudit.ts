export type AttendanceAudit = {
  location: string | null;
  ip: string | null;
  device: string;
};

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

export async function getLocationLabel(): Promise<string | null> {
  if (!navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve(`${roundCoord(latitude)}, ${roundCoord(longitude)} (±${Math.round(accuracy)} m)`);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export async function collectAttendanceAudit(): Promise<AttendanceAudit> {
  const [location, ip] = await Promise.all([getLocationLabel(), getNetworkIp()]);
  return { location, ip, device: getDeviceInfo() };
}