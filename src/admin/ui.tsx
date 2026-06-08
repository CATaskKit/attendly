import { type CSSProperties, type ReactNode } from 'react';

const A_ICONS: Record<string, string> = {
  grid: 'M4 4h7v7H4V4 M13 4h7v7h-7V4 M13 13h7v7h-7v-7 M4 13h7v7H4v-7',
  inbox: 'M3 12h5l2 3h4l2-3h5 M5 5h14l2 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-7',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  calendarClock: 'M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6 M16 2v4 M8 2v4 M3 10h18 M17.5 21a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9 M17.5 15v2l1.3 1.3',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2 M3 7h16a2 2 0 0 1 2 2v0H5a2 2 0 0 1-2-2 M16 13h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M21 21l-4.3-4.3',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M22 11.5V12a10 10 0 1 1-5.9-9.1 M22 4 12 14.1l-3-3',
  x: 'M18 6 6 18 M6 6l12 12',
  xCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M15 9l-6 6 M9 9l6 6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 7v5l3 2',
  plus: 'M12 5v14 M5 12h14',
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
  arrowDown: 'M12 5v14 M19 12l-7 7-7-7',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5L22 3',
  umbrella: 'M12 2v2 M12 20a2 2 0 0 0 2-2v-6 M3 12a9 9 0 0 1 18 0Z',
  coffee: 'M17 8h1a4 4 0 1 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z M6 2v2 M10 2v2 M14 2v2',
  briefcase: 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2 M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1 M3 12h18',
  house: 'M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5',
  calendar: 'M8 2v4 M16 2v4 M3 9h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  building: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16 M9 7h2 M9 11h2 M9 15h2 M15 9h2a2 2 0 0 1 2 2v10',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  more: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10',
  trash: 'M3 6h18 M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2 M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6 M10 11v6 M14 11v6',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M5 3v4 M3 5h4 M19 17v4 M17 19h4',
};

export function AIcon({ name, size = 20, color = 'currentColor', sw = 1.7, style }: { name: string; size?: number; color?: string; sw?: number; style?: CSSProperties }) {
  const d = A_ICONS[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

export function AAvatar({ name = '', size = 38, tone }: { name?: string; size?: number; tone?: string }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const palette = ['#1573e6', '#19a64a', '#7a5af0', '#d9730b', '#0ea5b7', '#e0463a'];
  const idx = (name || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  const bg = tone || palette[idx];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `color-mix(in oklab, ${bg} 16%, #fff)`, color: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, letterSpacing: '-0.02em',
    }}>{initials}</div>
  );
}

export function ACard({ children, style, pad = 22, onClick }: { children: ReactNode; style?: CSSProperties; pad?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16,
      padding: pad, boxSizing: 'border-box', cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
}

export type ATone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'purple';
export function APill({ children, tone = 'neutral', style }: { children: ReactNode; tone?: ATone; style?: CSSProperties }) {
  const t: Record<ATone, [string, string]> = {
    neutral: ['var(--soft)', 'var(--ink-2)'], accent: ['var(--accent-soft)', 'var(--accent-deep)'],
    green: ['var(--green-soft)', 'var(--green)'], amber: ['var(--amber-soft)', 'var(--amber)'],
    red: ['var(--red-soft)', 'var(--red)'], purple: ['#eee9fd', '#6a45dd'],
  };
  const [bg, fg] = t[tone] || t.neutral;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color: fg, fontWeight: 600, fontSize: 12, padding: '4px 10px', borderRadius: 999, lineHeight: 1.3, whiteSpace: 'nowrap', ...style }}>{children}</span>;
}

export function ABadge({ status }: { status: string }) {
  const map: Record<string, ATone> = { Pending: 'amber', Approved: 'green', Rejected: 'red', Cancelled: 'neutral', Present: 'green', Absent: 'red', Late: 'amber', Leave: 'accent', WFH: 'purple', Holiday: 'neutral', Active: 'green', Inactive: 'neutral', 'On leave': 'amber' };
  return <APill tone={map[status] || 'neutral'}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{status}</APill>;
}

export function KPI({ icon, label, value, sub, tone = 'accent', onClick }: { icon: string; label: string; value: ReactNode; sub?: string; tone?: string; onClick?: () => void }) {
  return (
    <ACard pad={18} onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(onClick ? { transition: 'transform .14s, box-shadow .14s' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `var(--${tone}-soft)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AIcon name={icon} size={21} color={`var(--${tone})`} sw={1.9} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginTop: 6 }}>{label}{sub && <span style={{ fontWeight: 500 }}> · {sub}</span>}</div>
      </div>
    </ACard>
  );
}

export function Segmented({ options, value, onChange }: { options: (string | { value: string; label: string; n?: number })[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--soft)', borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const n = typeof o === 'object' ? o.n : null;
        const on = v === value;
        return <button key={v} onClick={() => onChange(v)} style={{ border: 'none', cursor: 'pointer', background: on ? 'var(--panel)' : 'transparent', color: on ? 'var(--ink-1)' : 'var(--ink-3)', fontWeight: 600, fontSize: 13, padding: '6px 13px', borderRadius: 8, boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{lbl}{n != null && <span style={{ fontSize: 11, fontWeight: 700, background: on ? 'var(--accent-soft)' : 'var(--line)', color: on ? 'var(--accent-deep)' : 'var(--ink-3)', borderRadius: 999, padding: '1px 6px' }}>{n}</span>}</button>;
      })}
    </div>
  );
}

export function AToast({ show, text, tone = 'green', icon = 'checkCircle' }: { show: boolean; text?: string; tone?: string; icon?: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`, opacity: show ? 1 : 0, transition: 'all .3s cubic-bezier(.2,.8,.2,1)', pointerEvents: 'none', zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ink-1)', color: '#fff', padding: '13px 18px', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', fontWeight: 600, fontSize: 14 }}>
      <AIcon name={icon} size={19} color={`var(--${tone})`} sw={2.2} />{text}
    </div>
  );
}

export function BtnGhost({ icon, children, onClick, disabled }: { icon?: string; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>{icon && <AIcon name={icon} size={17} color="var(--ink-2)" />}{children}</button>;
}
export function BtnPrimary({ icon, children, onClick, tone = 'accent', disabled }: { icon?: string; children: ReactNode; onClick?: () => void; tone?: string; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: `var(--${tone})`, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, boxShadow: `0 4px 12px color-mix(in oklab, var(--${tone}) 30%, transparent)` }}>{icon && <AIcon name={icon} size={17} color="#fff" sw={2} />}{children}</button>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.03em' }}>{title}</h1>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{children}</div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 60, color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2.6px solid var(--line)', borderTopColor: 'var(--accent)', animation: 'loginSpin .7s linear infinite', display: 'inline-block' }} />
      {label || 'Loading…'}
    </div>
  );
}
