import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

// ── Icon set (simple line icons, 24×24) ──────────────────────────────
export const ICONS: Record<string, string> = {
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  home: 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5',
  history: 'M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-7 3 M3 4v4h4 M12 7v5l3 2',
  leave: 'M3 21h18 M5 21V8l7-4 7 4v13 M9 21v-5h6v5 M9 11h.01 M15 11h.01',
  user: 'M20 21a8 8 0 1 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  mapPin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0 M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  camera: 'M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2 M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.5V12a10 10 0 1 1-5.9-9.1 M22 4 12 14.1l-3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 7v5l3 2',
  calendar: 'M8 2v4 M16 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  plus: 'M12 5v14 M5 12h14',
  x: 'M18 6 6 18 M6 6l12 12',
  wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M2 9a15 15 0 0 1 20 0 M12 20h.01',
  device: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 M11 19h2',
  arrowRight: 'M5 12h14 M13 5l7 7-7 7',
  sun: 'M12 4V2 M12 22v-2 M5 5 3.5 3.5 M20.5 20.5 19 19 M4 12H2 M22 12h-2 M5 19l-1.5 1.5 M20.5 3.5 19 5 M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  briefcase: 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2 M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1 M3 12h18',
  umbrella: 'M12 2v2 M12 20a2 2 0 0 0 2-2v-6 M3 12a9 9 0 0 1 18 0Z',
  coffee: 'M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z M6 2v2 M10 2v2 M14 2v2',
  house: 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5 M9 21v-6h6v6',
  paperclip: 'M21 8.5 12.8 16.7a4 4 0 0 1-5.7-5.7l8.2-8.2a2.7 2.7 0 0 1 3.8 3.8l-8.2 8.2a1.3 1.3 0 0 1-1.9-1.9l7.5-7.5',
  signal: 'M2 20h.01 M7 20v-4 M12 20v-8 M17 20V8 M22 4v16',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5',
  flag: 'M4 22V4 M4 4h13l-2 4 2 4H4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-6',
  image: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1 M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M21 16l-5-5L6 21',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  trash: 'M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 9l5-5 5 5 M12 4v12',
  inbox: 'M3 12h5l2 3h4l2-3h5 M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-7',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M22 7l-9.2 5.6a1.5 1.5 0 0 1-1.6 0L2 7',
  lock: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1 M8 11V7a4 4 0 0 1 8 0v4 M12 15v3',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  eyeOff: 'M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.5 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3 4.1 M6.1 6.1A17.7 17.7 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 3-.5',
  faceId: 'M4 8V6a2 2 0 0 1 2-2h2 M16 4h2a2 2 0 0 1 2 2v2 M20 16v2a2 2 0 0 1-2 2h-2 M8 20H6a2 2 0 0 1-2-2v-2 M9 9v1.5 M15 9v1.5 M12 9v3.5h-1.2 M9.2 15.2a4 4 0 0 0 5.6 0',
  building: 'M3 21h18 M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16 M15 21V9h3a1 1 0 0 1 1 1v11 M8.5 8h.01 M11.5 8h.01 M8.5 12h.01 M11.5 12h.01 M8.5 16h.01 M11.5 16h.01',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20',
};

export type IconName = keyof typeof ICONS | string;

export function Icon({
  name, size = 22, color = 'currentColor', strokeWidth = 1.8, fill = 'none', style,
}: {
  name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string; style?: CSSProperties;
}) {
  const d = ICONS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

// ── Avatar (initials, no photo dependency) ───────────────────────────
export function Avatar({ name = 'Aarav Mehta', size = 40, accent }: { name?: string; size?: number; accent?: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: accent || 'var(--accent-soft)', color: accent ? '#fff' : 'var(--accent)',
      fontWeight: 700, fontSize: size * 0.36, letterSpacing: '-0.02em',
    }}>{initials}</div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
export function Card({ children, style, pad = 16, onClick }: { children: ReactNode; style?: CSSProperties; pad?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--card)', borderRadius: 'var(--r-card)',
      border: 'var(--card-border)', boxShadow: 'var(--card-shadow)',
      padding: pad, boxSizing: 'border-box',
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

// ── Pill / chip ──────────────────────────────────────────────────────
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export function Pill({ children, tone = 'neutral', style }: { children: ReactNode; tone?: Tone; style?: CSSProperties }) {
  const tones: Record<Tone, [string, string]> = {
    neutral: ['var(--muted-soft)', 'var(--text-2)'],
    accent: ['var(--accent-soft)', 'var(--accent)'],
    success: ['var(--success-soft)', 'var(--success)'],
    warning: ['var(--warning-soft)', 'var(--warning)'],
    danger: ['var(--danger-soft)', 'var(--danger)'],
  };
  const [bg, fg] = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color: fg, fontWeight: 600, fontSize: 12.5,
      padding: '4px 10px', borderRadius: 999, lineHeight: 1.2, ...style,
    }}>{children}</span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Tone> = {
    Pending: 'warning', Approved: 'success', Rejected: 'danger', Cancelled: 'neutral',
    Present: 'success', Absent: 'danger', Late: 'warning', Leave: 'accent', WFH: 'accent', Holiday: 'neutral',
  };
  const dot = ['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(status);
  return <Pill tone={map[status] || 'neutral'}>{dot && <span style={{ fontSize: 8 }}>●</span>}{status}</Pill>;
}

// ── Slide to confirm ─────────────────────────────────────────────────
export function SlideToConfirm({
  label = 'Slide to check in', onConfirm, tone = 'var(--accent)', icon = 'arrowRight',
}: {
  label?: string; onConfirm?: () => void; tone?: string; icon?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const drag = useRef({ active: false, max: 0, startX: 0 });
  const KNOB = 56, PAD = 5;

  const begin = (clientX: number) => {
    if (done || !trackRef.current) return;
    const tw = trackRef.current.offsetWidth;
    drag.current = { active: true, max: tw - KNOB - PAD * 2, startX: clientX - x };
  };
  const move = (clientX: number) => {
    if (!drag.current.active) return;
    let nx = clientX - drag.current.startX;
    nx = Math.max(0, Math.min(drag.current.max, nx));
    setX(nx);
  };
  const end = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (x > drag.current.max * 0.82) {
      setX(drag.current.max); setDone(true);
      setTimeout(() => onConfirm && onConfirm(), 240);
    } else setX(0);
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => move(e.clientX);
    const mu = () => end();
    const tm = (e: TouchEvent) => move(e.touches[0].clientX);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: false }); window.addEventListener('touchend', mu);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', mu);
    };
  });

  const prog = drag.current.max ? x / drag.current.max : 0;
  return (
    <div ref={trackRef} style={{
      position: 'relative', height: KNOB + PAD * 2, borderRadius: 999,
      background: 'var(--muted-soft)', overflow: 'hidden', userSelect: 'none',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        background: tone, opacity: done ? 1 : 0.12 + prog * 0.5,
        width: done ? '100%' : x + KNOB + PAD * 2, transition: drag.current.active ? 'none' : 'all .2s',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: done ? '#fff' : 'var(--text-2)', fontWeight: 600, fontSize: 15,
        opacity: done ? 1 : 1 - prog * 1.3, transition: 'opacity .1s',
        paddingLeft: 40, pointerEvents: 'none',
      }}>{done ? 'Done' : label}</div>
      <div
        onMouseDown={(e) => begin(e.clientX)}
        onTouchStart={(e) => begin(e.touches[0].clientX)}
        style={{
          position: 'absolute', top: PAD, left: PAD + x, width: KNOB, height: KNOB,
          borderRadius: '50%', background: '#fff', cursor: 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          transition: drag.current.active ? 'none' : 'left .2s',
        }}>
        <Icon name={done ? 'check' : icon} size={24} color={tone} strokeWidth={2.4} />
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────
export function Toast({ show, icon = 'checkCircle', text }: { show: boolean; icon?: string; text?: string }) {
  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 80,
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--text-1)', color: 'var(--card)', padding: '14px 16px',
      borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      transform: show ? 'translateY(0)' : 'translateY(20px)', opacity: show ? 1 : 0,
      pointerEvents: 'none', transition: 'all .3s cubic-bezier(.2,.8,.2,1)',
      fontWeight: 600, fontSize: 14,
    }}>
      <Icon name={icon} size={20} color="var(--success)" strokeWidth={2.2} />
      {text}
    </div>
  );
}
