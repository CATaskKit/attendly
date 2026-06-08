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

  try {
    const { App } = await import('@capacitor/app');
    // Android hardware back: go back in history, or exit at the root route.
    App.addListener('backButton', ({ canGoBack }) => {
      const atRoot = location.hash === '' || location.hash === '#/' || location.hash === '#';
      if (canGoBack && !atRoot) window.history.back();
      else App.exitApp();
    });
  } catch {
    /* app plugin unavailable — ignore */
  }
}
