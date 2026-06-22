// Native (Capacitor) bridges. On the web every helper degrades gracefully:
// permission requests are no-ops and file saving falls back to a browser
// download. On Android we ask for camera + photo access up-front and route
// exported files through Filesystem + the system share sheet, because a plain
// blob `a.click()` download silently fails inside the WebView.
import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Ask the user for camera + photo-library access (used to capture/attach
 * receipts and documents). Safe to call repeatedly; never throws.
 */
export async function requestMediaPermissions(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Camera } = await import('@capacitor/camera');
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  } catch (e) {
    console.warn('Media permission request failed', e);
  }
}

/**
 * Ask up-front for everything the app uses: camera + photos (receipts/selfie),
 * location (attendance check-in), and storage (saving exports). Each request is
 * isolated so one denial doesn't stop the others. Safe to call repeatedly.
 */
export async function requestAppPermissions(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Camera } = await import('@capacitor/camera');
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  } catch (e) { console.warn('Camera permission request failed', e); }
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.requestPermissions();
  } catch (e) { console.warn('Location permission request failed', e); }
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    await Filesystem.requestPermissions();
  } catch (e) { console.warn('Storage permission request failed', e); }
}

function browserDownload(filename: string, blob: Blob): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

async function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/**
 * Save a generated file (Excel, ZIP, …) straight to the device — no share sheet.
 * On the web this is a normal browser download; on native it writes directly to
 * the public Documents folder (visible in the Files app), falling back to
 * app-private external storage if the OS doesn't allow the public write.
 * Returns the saved location label (for a "Saved to …" message), if known.
 */
export async function saveFile(filename: string, data: Blob | ArrayBuffer, mime: string): Promise<string | void> {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (!isNative()) { browserDownload(filename, blob); return; }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const base64 = await toBase64(blob);
  // 1) Preferred: the phone's public Download folder (local storage, visible in
  //    Files / Downloads). Needs storage permission on older Android.
  try {
    try { await Filesystem.requestPermissions(); } catch { /* perm not needed on this OS */ }
    await Filesystem.writeFile({ path: `Download/${filename}`, data: base64, directory: Directory.ExternalStorage, recursive: true });
    return 'Downloads';
  } catch {
    // 2) Public Documents folder (no permission on most versions).
    try {
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents, recursive: true });
      return 'Documents';
    } catch {
      // 3) App-private external storage — always works, found via a file manager.
      await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.External, recursive: true });
      return 'app storage';
    }
  }
}

export const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/** Friendly "where did my file go" message from saveFile()'s returned location. */
export function savedMessage(where: string | void): string {
  if (where === 'Downloads') return 'Downloaded — check your Downloads folder';
  if (where === 'Documents') return 'Saved — check your Documents folder (Files app)';
  if (where) return 'Saved to the app’s files on your device';
  return 'Download started — check your browser downloads';
}

/**
 * Open the device settings where the user can enable location for this app.
 * Opens the app's permission/details page (where the Location toggle lives) on
 * Android, and the app settings on iOS. No-op on the web (browsers can't open
 * their own site-permission settings programmatically).
 */
export async function openLocationSettings(): Promise<void> {
  if (!isNative()) return;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings');
    await NativeSettings.open({ optionAndroid: AndroidSettings.ApplicationDetails, optionIOS: IOSSettings.App });
  } catch (e) {
    console.warn('Could not open location settings', e);
  }
}
