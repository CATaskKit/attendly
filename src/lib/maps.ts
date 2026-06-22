// Google Maps integration (optional). Activated by setting VITE_GOOGLE_MAPS_KEY.
// - Geocoding API   → a full formatted street address for a check-in.
// - Maps Static API → a map snapshot image of the check-in location.
// When the key is absent (or a call fails), callers fall back to the free
// reverse-geocoder / the in-app drawn map, so nothing breaks without a key.

export const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined)?.trim() || '';
export const hasGoogleMaps = (): boolean => !!GOOGLE_MAPS_KEY;

/** Static Maps 2D image URL with a marker on the point (for an <img src>). */
export function staticMapUrl(
  lat: number,
  lng: number,
  opts?: { zoom?: number; width?: number; height?: number; scale?: 1 | 2 },
): string | null {
  if (!GOOGLE_MAPS_KEY) return null;
  const { zoom = 16, width = 640, height = 280, scale = 2 } = opts ?? {};
  const marker = `markers=${encodeURIComponent(`color:0x1573e6|${lat},${lng}`)}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=${scale}&${marker}&key=${GOOGLE_MAPS_KEY}`;
}

/** Full formatted address for lat/lng via the Google Geocoding API (or null). */
export async function googleGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`,
      { cache: 'no-store', signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = (await res.json()) as { status?: string; results?: Array<{ formatted_address?: string }> };
    if (d.status !== 'OK' || !d.results?.length) return null;
    return d.results[0].formatted_address ?? null;
  } catch {
    return null;
  }
}
