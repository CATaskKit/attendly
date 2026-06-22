// Native (Capacitor / Android) bootstrap. No-ops on the web — every native
// call is guarded by Capacitor.isNativePlatform() and lazy-imported so the
// browser bundle stays unaffected.
import { Capacitor } from '@capacitor/core';

export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // White status bar with dark icons (Style.Light = dark text for light bg).
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch {
    /* status-bar plugin unavailable — ignore */
  }

  // Note: the Android hardware-back behaviour is handled inside the employee app
  // (EmployeeApp) so it can be tab/overlay-aware: close an overlay → go to the
  // Home tab → only then minimise the app (never exit straight to the OS).
}
