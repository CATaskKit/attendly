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
 * Save a generated file (Excel, ZIP, …) to the device. On the web this is a
 * normal download; on native it writes to app storage and opens the share
 * sheet so the user can save it to Drive/Files/Downloads or send it on.
 */
export async function saveFile(filename: string, data: Blob | ArrayBuffer, mime: string): Promise<void> {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (!isNative()) { browserDownload(filename, blob); return; }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const base64 = await toBase64(blob);
  const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, url: written.uri });
  } catch {
    // User dismissed the share sheet — the file is still saved in app storage.
  }
}

export const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};
