import type { CSSProperties } from 'react';

const ACCENT = '#1573e6';

// Base design tokens + accent theme for the admin console (light sidebar).
export const ADMIN_VARS: CSSProperties = {
  '--bg': '#f4f6fa', '--panel': '#ffffff', '--ink-1': '#0f1722', '--ink-2': '#45505f', '--ink-3': '#8b95a4',
  '--line': '#e8ecf2', '--soft': '#eef2f7',
  '--green': '#19a64a', '--green-soft': '#e4f6ea', '--amber': '#cf870f', '--amber-soft': '#f8eedb',
  '--red': '#e0463a', '--red-soft': '#fce9e7', '--purple': '#7a5af0', '--purple-soft': '#eee9fd',
  '--mono': "'IBM Plex Mono', monospace",
  '--accent': ACCENT,
  '--accent-deep': `color-mix(in oklab, ${ACCENT} 78%, #000)`,
  '--accent-soft': `color-mix(in oklab, ${ACCENT} 12%, #fff)`,
  '--side-bg': '#ffffff',
  '--side-line': '#e8ecf2',
  '--side-ink': '#45505f',
  '--side-dim': '#8b95a4',
  '--side-active-bg': `color-mix(in oklab, ${ACCENT} 12%, #fff)`,
  '--side-active-ink': `color-mix(in oklab, ${ACCENT} 78%, #000)`,
  '--side-hover': '#eef2f7',
} as CSSProperties;
