import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  applyLeave, checkIn, checkOut, decideTeamLeave, ensureMyEmployee, getTodayAttendance,
  listHolidays, listMyAttendance, listMyTeamLeave, myLeave, myLeaveBalances,
  type AttendanceRow, type Employee, type Holiday, type LeaveBalance, type LeaveRow,
} from '../lib/api';
import { onTablesChange } from '../lib/realtime';
import PhoneFrame from '../components/PhoneFrame';
import { Toast } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';
import { collectAttendanceAudit, getDeviceInfo, type AttendanceAudit } from '../lib/attendanceAudit';
import { fetchNetworkTime, formatAppDate, APP_TIME_ZONE } from '../lib/networkTime';
import { HomeScreen, AttendanceScreen, ProfileScreen, BottomNav } from './screens';
import { LeaveScreen, ApprovalsScreen } from './leave';
import { CheckInScreen, CheckOutScreen, ApplyLeaveScreen, LogoutConfirm } from './overlays';
import { INITIAL_LEAVE, INITIAL_TEAM, type Ctx, type LeaveRequest, type Status, type TeamRequest } from './data';

const isoDate = (d: Date) => formatAppDate(d);
const parseDay = (value: string | null) => value ? new Date(`${value}T00:00:00`) : null;
const displayDay = (value: string | null) => {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
};

function mapLeave(r: LeaveRow): LeaveRequest {
  const status: LeaveRequest['status'] = r.status === 'Approved' ? 'Approved' : r.status === 'Rejected' ? 'Rejected' : 'Pending';
  return {
    type: r.type,
    from: displayDay(r.from_date),
    to: displayDay(r.to_date),
    half: r.half,
    days: Number(r.days),
    status,
    mgr: r.stage === 'hr' || r.stage === 'done' || r.status === 'Approved',
    rejectedBy: r.status === 'Rejected' ? (r.stage === 'hr' ? 'hr' : 'mgr') : undefined,
  };
}

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function mapTeamLeave(r: LeaveRow): TeamRequest {
  const today = isoDate(new Date());
  const status: TeamRequest['status'] =
    r.status === 'Rejected' ? 'Rejected'
      : r.status === 'Approved' ? 'Approved'
        : r.stage === 'hr' ? 'Forwarded'
          : 'Pending';
  return {
    id: r.id,
    name: r.emp || 'Employee',
    code: r.code || '-',
    type: r.type,
    from: displayDay(r.from_date),
    to: displayDay(r.to_date),
    days: Number(r.days),
    applied: r.applied_at ? relativeTime(r.applied_at) : 'recently',
    reason: r.reason || '',
    status,
    active: r.status === 'Approved' && !!r.from_date && !!r.to_date && r.from_date <= today && r.to_date >= today,
    resolvedAt: status === 'Pending' ? undefined : status === 'Forwarded' ? 'waiting for HR' : 'resolved',
  };
}

function mergeAttendance(rows: AttendanceRow[], row: AttendanceRow) {
  return [row, ...rows.filter((r) => r.id !== row.id)].sort((a, b) => b.day.localeCompare(a.day));
}

function weeklyHours(rows: AttendanceRow[]) {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.work_seconds ?? 0) / 3600]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return byDay.get(isoDate(d)) ?? 0;
  });
}

const fmtLeaveDays = (days: number) => Number.isInteger(days) ? String(days) : days.toFixed(1);
const sameLeaveType = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function leaveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/not enough|available|not configured|leave type/i.test(message)) return message;
  return 'Could not submit leave request';
}

function useAppClock() {
  // Always shows the real current time, corrected to network time once synced.
  // (It used to fake 9:41 AM in demo mode, which read as hardcoded text.)
  const offset = useRef(0);
  const [clock, setClock] = useState(() => ({
    now: new Date(),
    synced: false,
    source: null as string | null,
  }));
  useEffect(() => {
    let active = true;
    offset.current = 0;
    const nextNow = () => new Date(Date.now() + offset.current);
    setClock({ now: nextNow(), synced: false, source: null });

    const syncClock = async () => {
      try {
        const synced = await fetchNetworkTime();
        if (!active) return;
        offset.current = synced.at.getTime() - Date.now();
        setClock({ now: nextNow(), synced: true, source: synced.source });
      } catch (error) {
        console.warn('Online time sync failed', error);
        if (active) setClock((current) => ({ ...current, synced: false }));
      }
    };

    void syncClock();
    const tickId = setInterval(() => setClock((current) => ({ ...current, now: nextNow() })), 1000);
    const syncId = window.setInterval(() => { void syncClock(); }, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(tickId);
      clearInterval(syncId);
    };
  }, []);
  return clock;
}

export default function EmployeeApp() {
  const navigate = useNavigate();
  const { signOut, role, configured, profile } = useAuth();
  const orgId = profile?.org_id ?? null;
  const live = configured && !!orgId;
  const clock = useAppClock();
  const now = clock.now;
  const currentDay = isoDate(now);
  const t = DEFAULT_TWEAKS;

  const canApproveTeam = role === 'manager';
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [teamRows, setTeamRows] = useState<LeaveRow[]>([]);
  const [attendanceAudit, setAttendanceAudit] = useState<AttendanceAudit>(() => ({ location: null, ip: null, device: getDeviceInfo() }));

  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('out');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(live ? [] : INITIAL_LEAVE);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>(live ? [] : INITIAL_TEAM);

  const empName = employee?.name || profile?.full_name || 'You';

  const refreshAttendanceAudit = useCallback(async () => {
    const audit = await collectAttendanceAudit();
    setAttendanceAudit(audit);
    return audit;
  }, []);

  // Attendance is only recorded online: this resolves to trusted network time,
  // or null when the device can't reach the internet (so we can block the punch
  // instead of silently trusting the device clock).
  const getPunchTime = useCallback(async (): Promise<Date | null> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    try {
      const synced = await fetchNetworkTime();
      return synced.at;
    } catch (error) {
      console.warn('Punch time sync failed', error);
      return null;
    }
  }, []);

  const applyTodayState = useCallback((row: AttendanceRow | null) => {
    setAttendanceId(row?.id ?? null);
    setCheckInTime(row?.check_in_at ? new Date(row.check_in_at) : null);
    setCheckOutTime(row?.check_out_at ? new Date(row.check_out_at) : null);
    if (!row?.check_in_at) setStatus('out');
    else if (row.check_out_at) setStatus('done');
    else setStatus('in');
  }, []);

  const reloadLive = useCallback(async () => {
    if (!live || !profile || !orgId) return;
    try {
      const emp = await ensureMyEmployee(profile);
      setEmployee(emp);
      const [leaveRows, attRows, balances, holidayRows, today, approvals] = await Promise.all([
        myLeave(profile, emp),
        listMyAttendance(orgId, emp),
        myLeaveBalances(orgId, emp),
        listHolidays(),
        getTodayAttendance(orgId, emp, currentDay),
        canApproveTeam ? listMyTeamLeave(profile, emp) : Promise.resolve([]),
      ]);
      setLeaveRequests(leaveRows.map(mapLeave));
      setAttendanceRows(attRows);
      setLeaveBalances(balances);
      setHolidays(holidayRows);
      setTeamRows(approvals);
      setTeamRequests(approvals.map(mapTeamLeave));
      if (today) setAttendanceAudit({ location: today.location, ip: today.ip, device: today.device || getDeviceInfo() });
      applyTodayState(today);
    } catch (e) {
      console.error(e);
    }
  }, [applyTodayState, canApproveTeam, currentDay, live, orgId, profile]);

  useEffect(() => { void reloadLive(); }, [reloadLive]);
  // Live updates: refresh when leave/attendance change for this tenant.
  useEffect(() => {
    if (!live) return;
    return onTablesChange(['leave_requests', 'attendance'], () => { void reloadLive(); });
  }, [live, reloadLive]);
  useEffect(() => {
    if (live) return;
    setEmployee(null);
    setAttendanceRows([]);
    setLeaveBalances([]);
    setHolidays([]);
    setTeamRows([]);
    setLeaveRequests(INITIAL_LEAVE);
    setTeamRequests(INITIAL_TEAM);
  }, [live]);

  const showToast = (text: string, icon = 'checkCircle') => {
    setToast({ text, icon });
    setTimeout(() => setToast(null), 2600);
  };

  const fmtClock = (d: Date | null) => (d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: APP_TIME_ZONE }) : '-');
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
  const pendingApprovals = teamRequests.filter((r) => r.status === 'Pending').length;
  useEffect(() => { if (!canApproveTeam && tab === 'approvals') setTab('home'); }, [canApproveTeam, tab]);

  const ctx: Ctx = {
    tab, setTab: changeTab, status, checkInTime, checkOutTime, elapsed, now, leaveRequests,
    live, employee, employeeName: empName, attendanceRows, leaveBalances, holidays, weeklyHours: weeklyHours(attendanceRows),
    attendanceAudit, refreshAttendanceAudit,
    timeSynced: clock.synced, timeSource: clock.source,
    fmtClock, fmtDur,
    openOverlay: setOverlay, closeOverlay: () => setOverlay(null),
    doCheckIn: (audit = attendanceAudit) => {
      void getPunchTime().then((localTime) => {
        if (!localTime) { showToast('You are not connected to the internet', 'x'); return; }
        setCheckInTime(localTime); setCheckOutTime(null); setStatus('in'); setOverlay(null); showToast('Checked in at ' + fmtClock(localTime));
        if (live && orgId) {
          checkIn(orgId, employee, { checkedAt: localTime.toISOString(), location: audit.location || undefined, ip: audit.ip || undefined, device: audit.device })
            .then((row) => { setAttendanceId(row.id); setAttendanceRows((rows) => mergeAttendance(rows, row)); applyTodayState(row); })
            .catch(console.error);
        }
      });
    },
    doCheckOut: () => {
      void getPunchTime().then((out) => {
        if (!out) { showToast('You are not connected to the internet', 'x'); return; }
        const seconds = checkInTime ? (out.getTime() - checkInTime.getTime()) / 1000 : 0;
        setCheckOutTime(out); setStatus('done'); setOverlay(null); showToast('Checked out at ' + fmtClock(out));
        if (live && attendanceId) refreshAttendanceAudit().then((audit) => checkOut(attendanceId, seconds, { checkedAt: out.toISOString(), location: audit.location || undefined, ip: audit.ip || undefined, device: audit.device })).then(reloadLive).catch(console.error);
      });
    },
    submitLeave: (l) => {
      const fromDate = l.fromDate || isoDate(new Date());
      const toDate = l.half ? fromDate : (l.toDate || fromDate);
      if (live && orgId) {
        const balance = leaveBalances.find((b) => sameLeaveType(b.type, l.type));
        if (!employee) {
          showToast('Employee profile is still loading', 'x');
          return;
        }
        if (!balance) {
          showToast('This leave type is not assigned to you', 'x');
          return;
        }
        if (l.days > balance.available) {
          showToast(`Only ${fmtLeaveDays(balance.available)} ${balance.type} day${balance.available === 1 ? '' : 's'} available`, 'x');
          return;
        }
        setOverlay(null);
        applyLeave(orgId, { employee, empName, type: l.type, fromDate, toDate, days: l.days, half: l.half, reason: l.reason || '', attachment: l.attachment })
          .then(() => reloadLive())
          .then(() => showToast('Leave request submitted', 'leave'))
          .catch((err) => {
            console.error(err);
            showToast(leaveErrorMessage(err), 'x');
            void reloadLive();
          });
        return;
      }
      setLeaveRequests((r) => [{ ...l, from: l.from || displayDay(fromDate), to: l.to || displayDay(toDate), status: 'Pending', mgr: false }, ...r]);
      setOverlay(null); showToast('Leave request submitted', 'leave');
    },
    teamRequests,
    approveTeam: (id) => {
      const row = teamRows.find((x) => x.id === id);
      if (live && row) {
        decideTeamLeave(row, 'approve').then(reloadLive).then(() => showToast(`${row.emp || 'Employee'} leave forwarded to HR`)).catch((err) => {
          console.error(err);
          showToast(err instanceof Error ? err.message : 'Could not approve leave', 'x');
        });
        return;
      }
      setTeamRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'Approved', resolvedAt: 'just now' } : r)));
      const r = teamRequests.find((x) => x.id === id);
      showToast(`${r ? r.name + "'s" : ''} leave approved`);
    },
    rejectTeam: (id) => {
      const row = teamRows.find((x) => x.id === id);
      if (live && row) {
        decideTeamLeave(row, 'reject').then(reloadLive).then(() => showToast(`${row.emp || 'Employee'} leave rejected`, 'x')).catch((err) => {
          console.error(err);
          showToast(err instanceof Error ? err.message : 'Could not reject leave', 'x');
        });
        return;
      }
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
          {tab === 'attendance' && <AttendanceScreen ctx={ctx} />}
          {tab === 'approvals' && canApproveTeam && <ApprovalsScreen ctx={ctx} />}
          {tab === 'leave' && <LeaveScreen ctx={ctx} />}
          {tab === 'profile' && <ProfileScreen ctx={ctx} />}
        </div>
        <BottomNav tab={tab} setTab={changeTab} manager={canApproveTeam} pendingCount={pendingApprovals} />

        {overlay === 'checkin' && <CheckInScreen ctx={ctx} />}
        {overlay === 'checkout' && <CheckOutScreen ctx={ctx} />}
        {overlay === 'applyleave' && <ApplyLeaveScreen ctx={ctx} />}
        {overlay === 'logout' && <LogoutConfirm onCancel={ctx.closeOverlay} onConfirm={ctx.logout} />}

        <Toast show={!!toast} text={toast?.text} icon={toast?.icon || 'checkCircle'} />
      </div>
    </PhoneFrame>
  );
}
