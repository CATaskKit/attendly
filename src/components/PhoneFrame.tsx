import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';

// In the native app we always render full-screen (no desktop device mock).
const NATIVE = Capacitor.isNativePlatform();

/**
 * iOS-style device frame for the employee app.
 *
 * Inner screen is a fixed 402×874 canvas (matching the design), scaled to fit
 * the viewport on desktop and rendered full-bleed on phones / inside the native
 * Android shell.
 *
 * There is intentionally NO simulated status bar (clock / signal / battery):
 * on a real device the OS draws its own status bar, so the app only reserves
 * the top *space* it needs via the `--topbar` custom property:
 *   - phone / native  → the device safe-area inset (≈0 with a non-overlay
 *                       status bar) plus a little breathing room
 *   - desktop mock    → 54px so content clears the frame's notch
 * Screens read this with `height: var(--topbar)` for their top spacer.
 */
const SCREEN_W = 402;
const SCREEN_H = 874;

const TOPBAR_DEVICE = 'calc(env(safe-area-inset-top, 0px) + 8px)';
const TOPBAR_MOCK = '54px';
const SAFE_DEVICE = 'env(safe-area-inset-bottom, 0px)';
const SAFE_MOCK = '20px';

export default function PhoneFrame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const [scale, setScale] = useState(1);
  const [bleed, setBleed] = useState(NATIVE);

  useEffect(() => {
    const onResize = () => {
      const small = NATIVE || window.innerWidth < 460;
      setBleed(small);
      const pad = small ? 0 : 40;
      const s = Math.min(1, (window.innerWidth - pad) / SCREEN_W, (window.innerHeight - pad) / SCREEN_H);
      setScale(s);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const screen: CSSProperties = {
    position: 'relative', width: SCREEN_W, height: SCREEN_H, overflow: 'hidden',
    background: dark ? '#0e1116' : '#f4f6fa',
  };

  if (bleed) {
    return (
      <div style={{ ...screen, width: '100vw', height: '100vh', ['--topbar' as string]: TOPBAR_DEVICE, ['--safe' as string]: SAFE_DEVICE }}>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(1200px 800px at 50% -10%, #eef2f8 0%, #e4e9f1 45%, #dde3ec 100%)',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <div
          style={{
            width: SCREEN_W + 24, height: SCREEN_H + 24, borderRadius: 66, padding: 12,
            background: 'linear-gradient(150deg, #2a2d34, #14161b)',
            boxShadow: '0 40px 90px rgba(15,23,40,0.45), inset 0 0 0 2px rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ ...screen, borderRadius: 54, ['--topbar' as string]: TOPBAR_MOCK, ['--safe' as string]: SAFE_MOCK }}>
            {/* dynamic island (visual only) */}
            <div
              style={{
                position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
                width: 120, height: 34, borderRadius: 20, background: '#000', zIndex: 110,
              }}
            />
            {children}
            {/* home indicator */}
            <div
              style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                width: 134, height: 5, borderRadius: 3, background: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)', zIndex: 110,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
