import type { CSSProperties } from 'react';

export type Direction = 'Soft' | 'Crisp' | 'Bold';
export type Tweaks = { accent: string; direction: Direction; dark: boolean; role: 'Employee' | 'Manager' };

export const ACCENTS = ['#2f6bd6', '#4f5bd5', '#0e8f8a', '#157a4f'];

export const DEFAULT_TWEAKS: Tweaks = {
  accent: '#2f6bd6',
  direction: 'Soft',
  dark: false,
  role: 'Manager',
};

// Mirrors the design's themeVars(): produces the CSS custom-property bag for a theme.
export function themeVars(t: Tweaks): CSSProperties {
  const a = t.accent;
  const dark = t.dark;
  const card = dark ? '#181d25' : '#ffffff';
  const bg = dark ? '#0e1116' : '#f4f6fa';

  const dir = {
    Soft: { rCard: 18, rHero: 26, rBtn: 16, border: 'none', shadow: dark ? '0 2px 12px rgba(0,0,0,0.35)' : '0 2px 12px rgba(31,45,71,0.06)' },
    Crisp: { rCard: 10, rHero: 14, rBtn: 10, border: `1px solid ${dark ? '#262d38' : '#e4e9f1'}`, shadow: 'none' },
    Bold: { rCard: 16, rHero: 22, rBtn: 14, border: 'none', shadow: dark ? '0 6px 20px rgba(0,0,0,0.45)' : '0 8px 22px rgba(31,45,71,0.10)' },
  }[t.direction];

  const heroMix =
    t.direction === 'Bold'
      ? `linear-gradient(140deg, ${a}, color-mix(in oklab, ${a} 55%, #111))`
      : `linear-gradient(140deg, ${a}, color-mix(in oklab, ${a} 74%, #0a0a12))`;

  return {
    '--accent': a,
    '--accent-deep': `color-mix(in oklab, ${a} 76%, #000)`,
    '--accent-soft': `color-mix(in oklab, ${a} ${dark ? 22 : 12}%, ${card})`,
    '--accent-glow': `color-mix(in oklab, ${a} 36%, transparent)`,
    '--hero': heroMix,
    '--hero-done': `linear-gradient(140deg, ${dark ? '#1f2733' : '#2c3340'}, ${dark ? '#161c25' : '#1a2029'})`,
    '--hero-shadow': `0 12px 30px color-mix(in oklab, ${a} ${dark ? 30 : 24}%, transparent)`,

    '--bg': bg,
    '--card': card,
    '--text-1': dark ? '#f2f5f9' : '#11151c',
    '--text-2': dark ? '#c2cad6' : '#3a4250',
    '--text-3': dark ? '#7c8696' : '#8a93a3',
    '--hair': dark ? '#262d38' : '#e9edf3',
    '--muted-soft': dark ? '#222932' : '#eef1f6',

    '--success': dark ? '#34d27f' : '#16a34a',
    '--success-soft': `color-mix(in oklab, ${dark ? '#34d27f' : '#16a34a'} ${dark ? 20 : 13}%, ${card})`,
    '--warning': dark ? '#f0ad3c' : '#d4860b',
    '--warning-soft': `color-mix(in oklab, ${dark ? '#f0ad3c' : '#d4860b'} ${dark ? 20 : 14}%, ${card})`,
    '--danger': dark ? '#f87171' : '#dc2626',
    '--danger-soft': `color-mix(in oklab, ${dark ? '#f87171' : '#dc2626'} ${dark ? 20 : 12}%, ${card})`,

    '--map-bg': dark ? '#1a2029' : '#e7ecf3',
    '--map-road': dark ? '#2b333f' : '#ffffff',
    '--nav-bg': dark ? 'rgba(16,20,26,0.82)' : 'rgba(255,255,255,0.82)',
    '--mono': "'IBM Plex Mono', monospace",
    // '--safe' (bottom inset) is provided by PhoneFrame so it can be
    // device-aware: the real safe-area inset on a phone, 20px in the desktop mock.

    '--r-card': dir.rCard + 'px',
    '--r-hero': dir.rHero + 'px',
    '--r-btn': dir.rBtn + 'px',
    '--card-border': dir.border,
    '--card-shadow': dir.shadow,
  } as CSSProperties;
}
