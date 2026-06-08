import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { myLeave, applyLeave, checkIn, checkOut, type LeaveRow } from '../lib/api';
import PhoneFrame from '../components/PhoneFrame';
import { Toast } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';
import { HomeScreen, AttendanceScreen, ProfileScreen, BottomNav } from './screens';
import { LeaveScreen, ApprovalsScreen } from './leave';
import { CheckInScreen, CheckOutScreen, ApplyLeaveScreen, LogoutConfirm } from './overlays';
import { INITIAL_LEAVE, INITIAL_TEAM, type Ctx, type LeaveRequest, type Status, type TeamRequest } from './data';

// Map a Supabase leave row to the employee app's LeaveRequest shape.
function mapLeave(r: LeaveRow): LeaveRequest {
  const fmt = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
  const status: LeaveRequest['status'] = r.status === 'Approved' ? 'Approved' : r.status === 'Rejected' ? 'Rejected' : 'Pending';
  return {
    type: r.type, from: fmt(r.from_date), to: fmt(r.to_date), half: r.half, days: Number(r.days),
    status,
    mgr: r.stage === 'hr' || r.status === 'Approved',
    rejectedBy: r.status === 'Rejected' ? 'mgr' : undefined,
  };
}

// demo clock seeded at 9:41 today, ticking live
function useDemoClock() {
  const base = useRef((() => { const d = new Date(); d.setHours(9, 41, 12, 0); return d.getTime(); })());
  const start = useRef(Date.now());
  const [now, setNow] = useState(new Date(base.current));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date(base.current + (Date.now() - start.current))), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function EmployeeApp() {
  const navigate = useNavigate();
  const { signOut, role, configured, profile } = useAuth();
  const t = DEFAULT_TWEAKS;
  const now = useDemoClock();

  const orgId = profile?.org_id ?? null;
  const empName = profile?.full_name || 'You';
  const live = configured && !!orgId;
  const [attendanceId, setAttendanceId] = useState<string | null>(null);

  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('out');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(live ? [] : INITIAL_LEAVE);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>(INITIAL_TEAM);

  const loadMyLeave = useCallback(async () => {
    if (!live) return;
    try { setLeaveRequests((await myLeave(empName)).map(mapLeave)); } catch (e) { console.error(e); }
  }, [live, empName]);

  useEffect(() => { void loadMyLeave(); }, [loadMyLeave]);

  const showToast = (text: string, icon = 'checkCircle') => {
    setToast({ text, icon });
    setTimeout(() => setToast(null), 2600);
  };

  const fmtClock = (d: Date | null) => (d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
  const fmtDur = (secs: number) => {
    secs = Math.max(0, Math.floor(secs));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const elapsed =
    status === 'in' && checkInTime ? (now.getTime() - checkInTime.getTime()) / 1000
      : status === 'done' && checkInTime && checkOutTime ? (checkOutTime.getTime() - checkInTime.getTime()) / 1000
        : 0;

  const changeTab = (id: string) => { setOverlay(null); setTab(id); };
  const manager = t.role === 'Manager';
  const pendingApprovals = teamRequests.filter((r) => r.status === 'Pending').length;
  useEffect(() => { if (!manager && tab === 'approvals') setTab('home'); }, [manager, tab]);

  const ctx: Ctx = {
    tab, setTab: changeTab, status, checkInTime, checkOutTime, elapsed, now, leaveRequests,
    fmtClock, fmtDur,
    openOverlay: setOverlay, closeOverlay: () => setOverlay(null),
    doCheckIn: () => {
      setCheckInTime(new Date(now.getTime())); setStatus('in'); setOverlay(null); showToast('Checked in at ' + fmtClock(now));
      if (live && orgId) checkIn(orgId).then(setAttendanceId).catch(console.error);
    },
    doCheckOut: () => {
      const out = new Date(now.getTime());
      setCheckOutTime(out); setStatus('done'); setOverlay(null); showToast('Checked out · ' + fmtClock(now));
      if (live && attendanceId) checkOut(attendanceId, checkInTime ? (out.getTime() - checkInTime.getTime()) / 1000 : 0).catch(console.error);
    },
    submitLeave: (l) => {
      setLeaveRequests((r) => [{ ...l, status: 'Pending', mgr: false }, ...r]);
      setOverlay(null); showToast('Leave request submitted', 'leave');
      if (live && orgId) {
        applyLeave(orgId, { empName, type: l.type, days: l.days, half: l.half, reason: '' })
          .then(loadMyLeave).catch(console.error);
      }
    },
    teamRequests,
    approveTeam: (id) => {
      setTeamRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'Approved', resolvedAt: 'just now' } : r)));
      const r = teamRequests.find((x) => x.id === id);
      showToast(`${r ? r.name + "'s" : ''} leave approved`);
    },
    rejectTeam: (id) => {
      setTeamRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'Rejected', resolvedAt: 'just now', active: false } : r)));
      const r = teamRequests.find((x) => x.id === id);
      showToast(`${r ? r.name + "'s" : ''} leave rejected`, 'x');
    },
    logout: () => { void signOut().then(() => navigate('/')); },
    role,
    goAdmin: () => navigate('/admin'),
  };

  const vars = themeVars(t);

  return (
    <PhoneFrame dark={t.dark}>
      <div style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased', ...vars,
      }}>
        <div style={{ height: 'var(--topbar, 0px)', flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }} className="no-scrollbar">
          {tab === 'home' && <HomeScreen ctx={ctx} />}
          {tab === 'attendance' && <AttendanceScreen />}
          {tab === 'approvals' && manager && <ApprovalsScreen ctx={ctx} />}
          {tab === 'leave' && <LeaveScreen ctx={ctx} />}
          {tab === 'profile' && <ProfileScreen ctx={ctx} />}
        </div>
        <BottomNav tab={tab} setTab={changeTab} manager={manager} pendingCount={pendingApprovals} />

        {overlay === 'checkin' && <CheckInScreen ctx={ctx} />}
        {overlay === 'checkout' && <CheckOutScreen ctx={ctx} />}
        {overlay === 'applyleave' && <ApplyLeaveScreen ctx={ctx} />}
        {overlay === 'logout' && <LogoutConfirm onCancel={ctx.closeOverlay} onConfirm={ctx.logout} />}

        <Toast show={!!toast} text={toast?.text} icon={toast?.icon || 'checkCircle'} />
      </div>
    </PhoneFrame>
  );
}
