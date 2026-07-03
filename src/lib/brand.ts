// Single source of truth for product branding. Change it here and it updates
// across login, profile, logout and anywhere else the brand is shown.
export const APP_NAME = 'Attendly';
export const VENDOR = 'CATaskKit';
export const APP_VERSION = '1.2.2';
export const APP_TAGLINE = 'Sign in to mark your attendance and manage leave.';

// Public site URL used for emailed links (password reset, invites). MUST be the
// real deployed URL, not the runtime origin — inside the Android app and in local
// dev that origin is "localhost". Set VITE_SITE_URL at build time; falls back to
// the current origin only when it isn't configured.
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined)?.trim().replace(/\/+$/, ''))
  || `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
