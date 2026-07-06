import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cataskkit.attendly',
  appName: 'eHajri',
  // Vite outputs the production web build here; `cap sync` copies it into the
  // native Android project (android/app/src/main/assets/public).
  webDir: 'dist',
  // Match the app's light theme background (theme.ts --bg) so cold start doesn't
  // flash a dark webview before the UI paints.
  backgroundColor: '#f4f6fa',
  plugins: {
    SplashScreen: {
      backgroundColor: '#f4f6fa',
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      // The native status bar sits above the webview (no overlay), so the
      // app's content never renders underneath it.
      // White background with dark icons for a clean, professional look.
      // Capacitor: Style 'LIGHT' = dark text/icons for light backgrounds.
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
