import { type CSSProperties, type ReactNode } from 'react';
import { Icon, Avatar, Card, Pill, StatusBadge } from './ui';
import type { Ctx } from './data';

// ── Schematic map placeholder (no real tiles) ────────────────────────
export function MapView({ height = 190, label = 'HQ — Brigade Tech Park, Bengaluru' }: { height?: number; label?: string }) {
  return (
    <div style={{
      position: 'relative', height, borderRadius: 'var(--r-card)', overflow: 'hidden',
      border: 'var(--card-border)', background: 'var(--map-bg)',
      backgroundImage: `
        linear-gradient(90deg, transparent 0 46%, var(--map-road) 46% 54%, transparent 54%),
        linear-gradient(0deg, transparent 0 64%, var(--map-road) 64% 70%, transparent 70%),
        linear-gradient(0deg, transparent 0 24%, var(--map-road) 24% 28%, transparent 28%),
        linear-gradient(90deg, transparent 0 16%, var(--map-road) 16% 20%, transparent 20%),
        linear-gradient(90deg, transparent 0 76%, var(--map-road) 76% 80%, transparent 80%)`,
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 150, height: 150, borderRadius: '50%',
        background: 'var(--accent-soft)', opacity: 0.55, border: '1.5px dashed var(--accent)',
      }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
        <div className="pulse-ring" style={{ position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'var(--accent)' }} />
        <div style={{ position: 'relative', width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
      </div>
      <div style={{ position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 10, background: 'var(--card)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="mapPin" size={18} color="var(--accent)" />
      </div>
      <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card)', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', padding: '6px 10px', borderRadius: 10, maxWidth: '70%' }}>
        <Icon name="mapPin" size={14} color="var(--success)" />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
    </div>
  );
}

export function VRow({ icon, label, value, ok = true, mono }: { icon: string; label: string; value: string; ok?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--muted-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color="var(--text-2)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 600, fontFamily: mono ? 'var(--mono)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
      <Icon name="checkCircle" size={20} color={ok ? 'var(--success)' : 'var(--warning)'} strokeWidth={2} />
    </div>
  );
}

export function SelfieTile({ captured, onToggle }: { captured: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{
      position: 'relative', height: 96, width: 96, flexShrink: 0, borderRadius: 'var(--r-card)',
      overflow: 'hidden', cursor: 'pointer', border: 'var(--card-border)',
      background: captured ? 'var(--accent-soft)' : 'var(--muted-soft)',
      backgroundImage: captured ? 'none' : 'repeating-linear-gradient(45deg, transparent 0 7px, rgba(0,0,0,0.04) 7px 14px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      {captured ? (
        <>
          <Avatar name="Aarav Mehta" size={44} accent="var(--accent)" />
          <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={13} color="#fff" strokeWidth={3} />
          </div>
        </>
      ) : (
        <>
          <Icon name="camera" size={26} color="var(--text-3)" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>SELFIE</span>
        </>
      )}
    </div>
  );
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px 10px' }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{children}</h2>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: 0 }}>{action}</button>}
    </div>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />{label}</span>;
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: '4px 2px 16px' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>{subtitle}</div>}
    </div>
  );
}

const heroBtn: CSSProperties = {
  width: '100%', height: 52, borderRadius: 'var(--r-btn)', border: 'none', cursor: 'pointer',
  background: '#fff', color: 'var(--accent)', fontWeight: 700, fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
};

// ─────────────────────── HOME / TODAY ────────────────────────────────
export function HomeScreen({ ctx }: { ctx: Ctx }) {
  const { status, checkInTime, checkOutTime, elapsed, fmtClock, fmtDur, openOverlay, now } = ctx;
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const trend = [7.8, 8.2, 6.5, 8.6, 8.1, 4.0, 0];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxH = 9;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 18px' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{greeting},</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Aarav Mehta</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 42, height: 42, borderRadius: '50%', background: 'var(--card)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} color="var(--text-2)" />
            <span style={{ position: 'absolute', top: 9, right: 11, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', border: '1.5px solid var(--card)' }} />
          </div>
          <Avatar name="Aarav Mehta" size={42} accent="var(--accent)" />
        </div>
      </div>

      <div style={{
        borderRadius: 'var(--r-hero)', padding: 20, color: '#fff', position: 'relative', overflow: 'hidden',
        background: status === 'done' ? 'var(--hero-done)' : 'var(--hero)', boxShadow: 'var(--hero-shadow)',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, background: 'rgba(255,255,255,0.18)', padding: '5px 11px', borderRadius: 999 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: status === 'in' ? '#7CF6B0' : 'rgba(255,255,255,0.8)' }} />
            {status === 'out' ? 'Not checked in' : status === 'in' ? 'Working now' : 'Checked out'}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}>{dateStr}</span>
        </div>

        {status === 'out' && (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtClock(now)}</div>
            <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6, marginBottom: 18 }}>Shift 9:30 AM – 6:30 PM · HQ Bengaluru</div>
            <button onClick={() => openOverlay('checkin')} style={heroBtn}>
              <Icon name="mapPin" size={19} color="var(--accent)" strokeWidth={2.2} /> Check In
            </button>
          </div>
        )}
        {status === 'in' && (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 2 }}>Working time</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtDur(elapsed)}</div>
            <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6, marginBottom: 18 }}>Checked in at {fmtClock(checkInTime)} · HQ Bengaluru</div>
            <button onClick={() => openOverlay('checkout')} style={heroBtn}>
              <Icon name="clock" size={19} color="var(--accent)" strokeWidth={2.2} /> Check Out
            </button>
          </div>
        )}
        {status === 'done' && (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 2 }}>Total worked today</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtDur(elapsed)}</div>
            <div style={{ display: 'flex', gap: 22, marginTop: 16 }}>
              <div><div style={{ fontSize: 11.5, opacity: 0.8 }}>Check in</div><div style={{ fontSize: 16, fontWeight: 700 }}>{fmtClock(checkInTime)}</div></div>
              <div><div style={{ fontSize: 11.5, opacity: 0.8 }}>Check out</div><div style={{ fontSize: 16, fontWeight: 700 }}>{fmtClock(checkOutTime)}</div></div>
              <div><div style={{ fontSize: 11.5, opacity: 0.8 }}>Overtime</div><div style={{ fontSize: 16, fontWeight: 700 }}>+0:32</div></div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <Card pad={15}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="checkCircle" size={18} color="var(--success)" /><span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Present</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>18<span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 600 }}> / 22</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>days this month</div>
        </Card>
        <Card pad={15}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="leave" size={18} color="var(--accent)" /><span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Leave balance</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>12<span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 600 }}> days</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>across all types</div>
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle action="View all" onAction={() => ctx.setTab('attendance')}>This week</SectionTitle>
        <Card pad={16}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 96, gap: 8 }}>
            {trend.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', height: 70 }}>
                  <div style={{
                    width: '100%', height: `${Math.max((h / maxH) * 100, 3)}%`, borderRadius: 6,
                    background: i === 5 ? 'var(--warning)' : h === 0 ? 'var(--muted-soft)' : 'var(--accent)', opacity: h === 0 ? 1 : 0.9,
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: i === 6 ? 'var(--text-1)' : 'var(--text-3)' }}>{days[i]}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hair)' }}>
            <Legend color="var(--accent)" label="Full day" />
            <Legend color="var(--warning)" label="Half day" />
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Avg <b style={{ color: 'var(--text-1)' }}>7.8h</b></span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Upcoming</SectionTitle>
        <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)' }}>AUG</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>15</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>Independence Day</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>National holiday · Saturday</div>
          </div>
          <Pill tone="neutral">In 9 days</Pill>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────── ATTENDANCE TAB ──────────────────────────────
export function AttendanceScreen() {
  const log = [
    { d: 'Wed', date: 'Jun 5', in: '9:18', out: '6:42', h: '9:24', status: 'Present' },
    { d: 'Tue', date: 'Jun 4', in: '9:31', out: '6:35', h: '9:04', status: 'Late' },
    { d: 'Mon', date: 'Jun 3', in: '9:12', out: '1:30', h: '4:18', status: 'WFH' },
    { d: 'Sun', date: 'Jun 2', in: '—', out: '—', h: '—', status: 'Holiday' },
    { d: 'Sat', date: 'Jun 1', in: '—', out: '—', h: '—', status: 'Leave' },
    { d: 'Fri', date: 'May 31', in: '9:05', out: '6:20', h: '9:15', status: 'Present' },
  ];
  const summary = [
    { label: 'Present', value: 18, tone: 'success' },
    { label: 'Leave', value: 2, tone: 'accent' },
    { label: 'Absent', value: 0, tone: 'danger' },
    { label: 'Late', value: 3, tone: 'warning' },
  ];
  return (
    <div>
      <ScreenHeader title="Attendance" subtitle="June 2026" />
      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Attendance rate</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>94%</div>
          </div>
          <div style={{ position: 'relative', width: 62, height: 62 }}>
            <svg width="62" height="62" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="31" cy="31" r="26" fill="none" stroke="var(--muted-soft)" strokeWidth="8" />
              <circle cx="31" cy="31" r="26" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${0.94 * 163} 163`} />
            </svg>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {summary.map((s) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--muted-soft)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: `var(--${s.tone})` }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 22 }}>
        <SectionTitle action="Export">Daily log</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {log.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: i < log.length - 1 ? '1px solid var(--hair)' : 'none' }}>
              <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{e.d}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{e.date.split(' ')[1]}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{e.in === '—' ? '—' : `${e.in} – ${e.out}`}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{e.h === '—' ? 'No hours' : `${e.h} hrs`}</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
          ))}
        </Card>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ─────────────────────── PROFILE TAB ─────────────────────────────────
export function ProfileScreen({ ctx }: { ctx: Ctx }) {
  const rows = [
    { icon: 'user', label: 'Employee code', value: 'ATL-2041' },
    { icon: 'briefcase', label: 'Designation', value: 'Sr. Product Designer' },
    { icon: 'flag', label: 'Department', value: 'Design' },
    { icon: 'user', label: 'Reporting to', value: 'Priya Nair' },
    { icon: 'calendar', label: 'Joined', value: '14 Mar 2022' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 22px' }}>
        <Avatar name="Aarav Mehta" size={84} accent="var(--accent)" />
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 12, letterSpacing: '-0.02em' }}>Aarav Mehta</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)' }}>aarav.mehta@ontime.co</div>
        <div style={{ marginTop: 10 }}><Pill tone="success"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />Active</Pill></div>
      </div>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: i < rows.length - 1 ? '1px solid var(--hair)' : 'none' }}>
            <Icon name={r.icon} size={19} color="var(--text-3)" />
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-3)', fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{r.value}</span>
          </div>
        ))}
      </Card>
      <Card pad={0} style={{ overflow: 'hidden', marginTop: 14 }}>
        {['Salary slips', 'Notification settings', 'Help & support'].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', borderBottom: i < 2 ? '1px solid var(--hair)' : 'none', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)' }}>{l}</span>
            <Icon name="chevronRight" size={18} color="var(--text-3)" />
          </div>
        ))}
      </Card>

      {(ctx.role === 'owner' || ctx.role === 'hr' || ctx.role === 'manager') && ctx.goAdmin && (
        <Card pad={0} style={{ overflow: 'hidden', marginTop: 14 }}>
          <div onClick={ctx.goAdmin} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', cursor: 'pointer' }}>
            <Icon name="briefcase" size={19} color="var(--accent)" />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--accent)' }}>Admin console</span>
            <Icon name="chevronRight" size={18} color="var(--text-3)" />
          </div>
        </Card>
      )}

      <button onClick={() => ctx.openOverlay('logout')} style={{
        width: '100%', marginTop: 14, height: 52, borderRadius: 'var(--r-card)',
        border: 'var(--card-border)', background: 'var(--card)', boxShadow: 'var(--card-shadow)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        color: 'var(--danger)', fontWeight: 700, fontSize: 14.5, fontFamily: 'inherit',
      }}>
        <Icon name="logout" size={18} color="var(--danger)" strokeWidth={2.1} />
        Log out
      </button>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, marginTop: 14 }}>On Time · v2.4.1</div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ─────────────────────── BOTTOM NAV ──────────────────────────────────
export function BottomNav({ tab, setTab, manager, pendingCount = 0 }: { tab: string; setTab: (id: string) => void; manager: boolean; pendingCount?: number }) {
  const items = [
    { id: 'home', icon: 'home', label: 'Home', badge: 0 },
    { id: 'attendance', icon: 'history', label: 'Attendance', badge: 0 },
    ...(manager ? [{ id: 'approvals', icon: 'inbox', label: 'Approvals', badge: pendingCount }] : []),
    { id: 'leave', icon: 'leave', label: 'Leave', badge: 0 },
    { id: 'profile', icon: 'user', label: 'Profile', badge: 0 },
  ];
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
      background: 'var(--nav-bg)', borderTop: '1px solid var(--hair)',
      padding: '8px 4px calc(8px + var(--safe))', backdropFilter: 'blur(12px)',
    }}>
      {items.map((it) => {
        const on = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0' }}>
            <div style={{ position: 'relative' }}>
              <Icon name={it.icon} size={23} color={on ? 'var(--accent)' : 'var(--text-3)'} strokeWidth={on ? 2.2 : 1.8} />
              {it.badge > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--nav-bg)' }}>{it.badge}</span>
              )}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? 'var(--accent)' : 'var(--text-3)' }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
