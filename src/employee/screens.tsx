import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, Avatar, Card, Pill, StatusBadge } from './ui';
import type { Ctx } from './data';
import { useAuth } from '../lib/auth';
import { getMyEmployee, type Employee } from '../lib/api';
import { APP_NAME, APP_VERSION } from '../lib/brand';

// ── Schematic map placeholder (no real tiles) ────────────────────────
export function MapView({ height = 190, label = 'Current device location' }: { height?: number; label?: string }) {
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

export function SelfieTile({ captured, onToggle, name = 'You' }: { captured: boolean; onToggle: () => void; name?: string }) {
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
          <Avatar name={name} size={44} accent="var(--accent)" />
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
  const { status, checkInTime, checkOutTime, elapsed, fmtClock, fmtDur, openOverlay, now, employee, employeeName, attendanceRows, leaveBalances, holidays, weeklyHours, live } = ctx;
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  const overtimeSecs = Math.max(0, elapsed - 8 * 3600);
  const roleLine = [employee?.designation, employee?.dept].filter(Boolean).join(' · ') || 'Mark your attendance';
  const checkInLoc = attendanceRows[0]?.location || null;

  const trend = live && weeklyHours.some((h) => h > 0) ? weeklyHours : [7.8, 8.2, 6.5, 8.6, 8.1, 4.0, 0];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxH = Math.max(9, ...trend);
  const monthKey = now.toISOString().slice(0, 7);
  const monthRows = attendanceRows.filter((r) => r.day.startsWith(monthKey));
  const presentDays = live ? monthRows.filter((r) => ['Present', 'Late', 'WFH'].includes(r.status)).length : 18;
  const trackedDays = live ? Math.max(presentDays, monthRows.length) : 22;
  const leaveTotal = live ? leaveBalances.reduce((sum, b) => sum + b.available, 0) : 12;
  const leaveTotalText = Number.isInteger(leaveTotal) ? String(leaveTotal) : leaveTotal.toFixed(1);
  const avg = trend.length ? trend.reduce((sum, h) => sum + h, 0) / trend.length : 0;
  const todayIso = now.toISOString().slice(0, 10);
  const upcoming = holidays.filter((h) => h.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const upcomingDate = upcoming ? new Date(`${upcoming.date}T00:00:00`) : null;
  const daysAway = upcomingDate ? Math.max(0, Math.ceil((upcomingDate.getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000)) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 18px' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{greeting},</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{employeeName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => openOverlay('notifications')} style={{ position: 'relative', width: 42, height: 42, borderRadius: '50%', background: 'var(--card)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="bell" size={20} color="var(--text-2)" />
            {ctx.unreadCount > 0 && <span style={{ position: 'absolute', top: 5, right: 6, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 999, background: 'var(--danger)', color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--card)' }}>{ctx.unreadCount}</span>}
          </button>
          <Avatar name={employeeName} size={42} accent="var(--accent)" />
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
            <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6, marginBottom: 18 }}>{roleLine}</div>
            <button onClick={() => openOverlay('checkin')} style={heroBtn}>
              <Icon name="mapPin" size={19} color="var(--accent)" strokeWidth={2.2} /> Check In
            </button>
          </div>
        )}
        {status === 'in' && (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 2 }}>Working time</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmtDur(elapsed)}</div>
            <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6, marginBottom: 18 }}>Checked in at {fmtClock(checkInTime)}{checkInLoc ? ` · ${checkInLoc}` : ''}</div>
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
              <div><div style={{ fontSize: 11.5, opacity: 0.8 }}>Overtime</div><div style={{ fontSize: 16, fontWeight: 700 }}>+{fmtShort(overtimeSecs)}</div></div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        <Card pad={15}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="checkCircle" size={18} color="var(--success)" /><span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Present</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{presentDays}<span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 600 }}> / {trackedDays || 0}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>days this month</div>
        </Card>
        <Card pad={15}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="leave" size={18} color="var(--accent)" /><span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Leave balance</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{leaveTotalText}<span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 600 }}> days</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>across all types</div>
        </Card>
      </div>

      {ctx.announcements.length > 0 && (
        <Card pad={14} onClick={() => ctx.openOverlay('announcements')} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            <Icon name="bell" size={22} color="var(--accent)" />
            {ctx.unreadAnnouncements > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--danger)', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{ctx.unreadAnnouncements}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>Announcements</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.unreadAnnouncements > 0 ? `${ctx.unreadAnnouncements} new · ${ctx.announcements[0].title}` : ctx.announcements[0].title}</div>
          </div>
          <Icon name="chevronRight" size={18} color="var(--text-3)" />
        </Card>
      )}

      {ctx.reimbursementEnabled && (() => {
        const mine = ctx.reimbursements;
        const inr = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
        const sum = (st: string) => mine.filter((r) => r.status === st).reduce((a, r) => a + Number(r.amount || 0), 0);
        const pendingCount = mine.filter((r) => r.status === 'Pending').length;
        return (
          <Card pad={15} onClick={() => ctx.openOverlay('reimbursements')} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="receipt" size={21} color="var(--accent)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>Reimbursements</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{mine.length ? `${pendingCount} awaiting approval · tap to add or track` : 'Submit & track expense claims'}</div>
              </div>
              <Icon name="chevronRight" size={18} color="var(--text-3)" />
            </div>
            {mine.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 13, paddingTop: 13, borderTop: 'var(--card-border)' }}>
                {([['Pending', sum('Pending'), 'var(--warning)'], ['Approved', sum('Approved'), 'var(--accent)'], ['Paid', sum('Paid'), 'var(--success)']] as const).map(([label, val, color]) => (
                  <div key={label} style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color, marginTop: 2, letterSpacing: '-0.01em' }}>{inr(val)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

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
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Avg <b style={{ color: 'var(--text-1)' }}>{avg.toFixed(1)}h</b></span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Upcoming</SectionTitle>
        {upcoming && upcomingDate ? (
          <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)' }}>{upcomingDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{upcomingDate.getDate()}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>{upcoming.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{upcoming.type} holiday - {upcomingDate.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            </div>
            <Pill tone="neutral">{daysAway === 0 ? 'Today' : `In ${daysAway}d`}</Pill>
          </Card>
        ) : (
          <Card pad={14} style={{ color: 'var(--text-3)', fontSize: 13.5 }}>No upcoming holidays yet.</Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── ATTENDANCE TAB ──────────────────────────────
export function AttendanceScreen({ ctx }: { ctx: Ctx }) {
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }) : '-';
  const fmtHours = (seconds: number | null) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  };
  const demoLog = [
    { d: 'Wed', date: 'Jun 5', in: '9:18', out: '6:42', h: '9:24', status: 'Present' },
    { d: 'Tue', date: 'Jun 4', in: '9:31', out: '6:35', h: '9:04', status: 'Late' },
    { d: 'Mon', date: 'Jun 3', in: '9:12', out: '1:30', h: '4:18', status: 'WFH' },
    { d: 'Sun', date: 'Jun 2', in: '-', out: '-', h: '-', status: 'Holiday' },
    { d: 'Sat', date: 'Jun 1', in: '-', out: '-', h: '-', status: 'Leave' },
    { d: 'Fri', date: 'May 31', in: '9:05', out: '6:20', h: '9:15', status: 'Present' },
  ];
  const liveLog = ctx.attendanceRows.map((r) => {
    const d = new Date(`${r.day}T00:00:00`);
    return {
      d: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      in: fmtTime(r.check_in_at),
      out: fmtTime(r.check_out_at),
      h: fmtHours(r.work_seconds),
      status: r.status,
    };
  });
  const log = ctx.live ? liveLog : demoLog;
  const count = (status: string) => log.filter((r) => r.status === status).length;
  const presentLike = log.filter((r) => ['Present', 'Late', 'WFH'].includes(r.status)).length;
  const rate = log.length ? Math.round((presentLike / log.length) * 100) : 0;
  const summary = [
    { label: 'Present', value: count('Present'), tone: 'success' },
    { label: 'Leave', value: count('Leave'), tone: 'accent' },
    { label: 'Absent', value: count('Absent'), tone: 'danger' },
    { label: 'Late', value: count('Late'), tone: 'warning' },
  ];
  return (
    <div>
      <ScreenHeader title="Attendance" subtitle={ctx.now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} />
      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>Attendance rate</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{rate}%</div>
          </div>
          <div style={{ position: 'relative', width: 62, height: 62 }}>
            <svg width="62" height="62" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="31" cy="31" r="26" fill="none" stroke="var(--muted-soft)" strokeWidth="8" />
              <circle cx="31" cy="31" r="26" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(rate / 100) * 163} 163`} />
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
          {log.length === 0 && <div style={{ padding: 18, color: 'var(--text-3)', fontSize: 13.5 }}>No attendance records yet.</div>}
          {log.map((e, i) => (
            <div key={`${e.date}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: i < log.length - 1 ? '1px solid var(--hair)' : 'none' }}>
              <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{e.d}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{e.date.split(' ')[1]}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{e.in === '-' ? '-' : `${e.in} - ${e.out}`}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{e.h === '-' ? 'No hours' : `${e.h} hrs`}</div>
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

// ─────────────────────── PROFILE DATA HELPERS ────────────────────────
type PersonalInfoForm = {
  full_name: string;
  phone: string;
  personal_email: string;
  date_of_birth: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
};

const emptyInfo: PersonalInfoForm = {
  full_name: '',
  phone: '',
  personal_email: '',
  date_of_birth: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const demoEmployee: Employee = {
  id: 'demo',
  code: 'ATL-2041',
  name: 'Aarav Mehta',
  dept: 'Design',
  designation: 'Sr. Product Designer',
  manager: 'Priya Nair',
  type: 'Full-time',
  status: 'Active',
  email: 'aarav.mehta@ontime.co',
  phone: '+91 98860 41122',
  joined: '2022-03-14',
};

function formatProfileDate(value?: string | null) {
  if (!value) return 'Not added';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProfileRow({ icon, label, value, last = false }: { icon: string; label: string; value?: string | null; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: last ? 'none' : '1px solid var(--hair)' }}>
      <Icon name={icon} size={19} color="var(--text-3)" />
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ maxWidth: '52%', textAlign: 'right', fontSize: 14, fontWeight: 700, color: value ? 'var(--text-1)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || 'Not added'}</span>
    </div>
  );
}

function InfoInput({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', marginBottom: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', height: 44, boxSizing: 'border-box', borderRadius: 12,
          border: '1.5px solid var(--hair)', background: 'var(--bg)', color: 'var(--text-1)',
          padding: '0 12px', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
        }}
      />
    </label>
  );
}

export function ProfileScreen({ ctx }: { ctx: Ctx }) {
  const { configured, profile, updateProfile } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(configured ? null : demoEmployee);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PersonalInfoForm>(emptyInfo);

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      personal_email: profile.personal_email || '',
      date_of_birth: profile.date_of_birth || '',
      address: profile.address || '',
      emergency_contact_name: profile.emergency_contact_name || '',
      emergency_contact_phone: profile.emergency_contact_phone || '',
    });
  }, [profile]);

  useEffect(() => {
    let active = true;
    if (!configured || !profile) {
      setEmployee(demoEmployee);
      return;
    }
    getMyEmployee(profile)
      .then((row) => { if (active) setEmployee(row); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load employee details.'); });
    return () => { active = false; };
  }, [configured, profile]);

  const setInfo = (key: keyof PersonalInfoForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const name = form.full_name || employee?.name || profile?.full_name || 'You';
  const email = profile?.email || employee?.email || 'Not added';
  const status = employee?.status || 'Active';
  const workRows = [
    { icon: 'user', label: 'Employee code', value: employee?.code },
    { icon: 'briefcase', label: 'Designation', value: employee?.designation },
    { icon: 'flag', label: 'Department', value: employee?.dept },
    { icon: 'user', label: 'Reporting to', value: employee?.manager },
    { icon: 'calendar', label: 'Joined', value: formatProfileDate(employee?.joined) },
  ];
  const personalRows = [
    { icon: 'device', label: 'Mobile', value: form.phone || employee?.phone },
    { icon: 'mail', label: 'Personal email', value: form.personal_email },
    { icon: 'calendar', label: 'Date of birth', value: formatProfileDate(form.date_of_birth) },
    { icon: 'house', label: 'Address', value: form.address },
    { icon: 'user', label: 'Emergency contact', value: form.emergency_contact_name },
    { icon: 'device', label: 'Emergency phone', value: form.emergency_contact_phone },
  ];

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    const { error: saveError } = await updateProfile({
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() || null,
      personal_email: form.personal_email.trim() || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    });
    setSaving(false);
    if (saveError) { setError(saveError); return; }
    setEditing(false);
    setNotice('Personal information saved.');
    setTimeout(() => setNotice(null), 2600);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 22px' }}>
        <Avatar name={name} size={84} accent="var(--accent)" />
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', marginTop: 12, letterSpacing: '-0.02em', textAlign: 'center' }}>{name}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
        <div style={{ marginTop: 10 }}><Pill tone={status === 'Active' ? 'success' : 'neutral'}><span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'Active' ? 'var(--success)' : 'var(--text-3)' }} />{status}</Pill></div>
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--success-soft)' }}>
          <Icon name="checkCircle" size={16} color="var(--success)" strokeWidth={2} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--success)' }}>{notice}</span>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--r-card)', background: 'var(--danger-soft)' }}>
          <Icon name="shield" size={16} color="var(--danger)" strokeWidth={2} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', lineHeight: 1.4 }}>{error}</span>
        </div>
      )}

      <SectionTitle>Work information</SectionTitle>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        {workRows.map((r, i) => <ProfileRow key={r.label} {...r} last={i === workRows.length - 1} />)}
      </Card>

      <SectionTitle action={editing ? 'Cancel' : 'Edit'} onAction={() => { setEditing((open) => !open); setError(null); setNotice(null); }}>Personal information</SectionTitle>
      {editing ? (
        <Card pad={16}>
          <InfoInput label="Full name" value={form.full_name} onChange={(v) => setInfo('full_name', v)} placeholder="Your full name" />
          <InfoInput label="Mobile" value={form.phone} onChange={(v) => setInfo('phone', v)} placeholder="+91 90000 00000" />
          <InfoInput label="Personal email" type="email" value={form.personal_email} onChange={(v) => setInfo('personal_email', v)} placeholder="name@example.com" />
          <InfoInput label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => setInfo('date_of_birth', v)} />
          <InfoInput label="Address" value={form.address} onChange={(v) => setInfo('address', v)} placeholder="Home address" />
          <InfoInput label="Emergency contact name" value={form.emergency_contact_name} onChange={(v) => setInfo('emergency_contact_name', v)} placeholder="Contact name" />
          <InfoInput label="Emergency contact phone" value={form.emergency_contact_phone} onChange={(v) => setInfo('emergency_contact_phone', v)} placeholder="+91 90000 00000" />
          <button onClick={save} disabled={saving} style={{
            width: '100%', height: 48, borderRadius: 'var(--r-btn)', border: 'none', cursor: saving ? 'default' : 'pointer',
            background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1,
          }}>
            <Icon name="check" size={18} color="#fff" strokeWidth={2.4} />
            {saving ? 'Saving...' : 'Save personal information'}
          </button>
        </Card>
      ) : (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {personalRows.map((r, i) => <ProfileRow key={r.label} {...r} last={i === personalRows.length - 1} />)}
        </Card>
      )}

      <Card pad={0} style={{ overflow: 'hidden', marginTop: 14 }}>
        {['Salary slips', 'Notification settings', 'Help & support'].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', borderBottom: i < 2 ? '1px solid var(--hair)' : 'none', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)' }}>{l}</span>
            <Icon name="chevronRight" size={18} color="var(--text-3)" />
          </div>
        ))}
      </Card>

      <button onClick={() => ctx.openOverlay('logout')} style={{
        width: '100%', marginTop: 14, height: 52, borderRadius: 'var(--r-card)',
        border: 'var(--card-border)', background: 'var(--card)', boxShadow: 'var(--card-shadow)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        color: 'var(--danger)', fontWeight: 700, fontSize: 14.5, fontFamily: 'inherit',
      }}>
        <Icon name="logout" size={18} color="var(--danger)" strokeWidth={2.1} />
        Log out
      </button>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, marginTop: 14 }}>{APP_NAME} · v{APP_VERSION}</div>
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
