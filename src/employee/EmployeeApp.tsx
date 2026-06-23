import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  applyLeave, checkIn, checkOut, decideTeamLeave, decideLeave, listLeave, ensureMyEmployee, getTodayAttendance,
  listHolidays, listMyAttendance, listMyTeamLeave, myLeave, myLeaveBalances,
  applyReimbursement, myReimbursements, compOffEarned, getOrganizationSettings,
  cancelLeave as apiCancelLeave, cancelReimbursement as apiCancelReimbursement,
  listAnnouncements, listAnnouncementReads, markAnnouncementRead,
  type AttendanceRow, type Employee, type Holiday, type LeaveBalance, type LeaveRow, type Reimbursement, type Announcement,
} from '../lib/api';
import { onTablesChange } from '../lib/realtime';
import { fetchBilling, reimbursementActive } from '../lib/billing';
import { weekendConfigFrom } from '../lib/calendar';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from '../lib/api';
import PhoneFrame from '../components/PhoneFrame';
import { Toast } from './ui';
import { DEFAULT_TWEAKS, themeVars } from './theme';
import { collectAttendanceAudit, getDeviceInfo, locationMessage, distanceMeters, type AttendanceAudit } from '../lib/attendanceAudit';
import { fetchNetworkTime, formatAppDate, APP_TIME_ZONE } from '../lib/networkTime';
import { requestAppPermissions, isNative } from '../lib/native';
import { initPush } from '../lib/push';
import { HomeScreen, AttendanceScreen, ProfileScreen, BottomNav } from './screens';
import { LeaveScreen, ApprovalsScreen } from './leave';
import { CheckInScreen, CheckOutScreen, ApplyLeaveScreen, LogoutConfirm, NotificationsScreen, ReimbursementsScreen, AnnouncementsScreen } from './overlays';
import { INITIAL_LEAVE, INITIAL_TEAM, type Ctx, type LeaveRequest, type Status, type TeamRequest } from './data';

const isoDate = (d: Date) => formatAppDate(d);
const parseDay = (value: string | null) => value ? new Date(`${value}T00:00:00`) : null;
const displayDay = (value: string | null) => {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
};

function mapLeave(r: LeaveRow): LeaveRequest {
  const status: LeaveRequest['status'] = r.status === 'Approved' ? 'Approved' : r.status === 'Rejected' ? 'Rejected' : r.status === 'Cancelled' ? 'Cancelled' : 'Pending';
  return {
    id: r.id,
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

function mapTeamLeave(r: LeaveRow, asManager: boolean): TeamRequest {
  const today = isoDate(new Date());
  // For a manager, an hr-stage request is out of their hands ("Forwarded").
  // For HR/owner, an hr-stage (or any pending) request is theirs to action.
  const status: TeamRequest['status'] =
    r.status === 'Rejected' ? 'Rejected'
      : r.status === 'Approved' ? 'Approved'
        : (asManager && r.stage === 'hr') ? 'Forwarded'
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

  // Managers approve their own team; HR/owner can approve across the org. All
  // three get the in-app Approvals module.
  const canApproveTeam = role === 'manager' || role === 'hr' || role === 'owner';
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [teamRows, setTeamRows] = useState<LeaveRow[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [reimbState, setReimbState] = useState<{ enabled: boolean; requireManager: boolean }>({ enabled: false, requireManager: true });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnIds, setReadAnnIds] = useState<Set<string>>(new Set());
  const [geo, setGeo] = useState<{ enabled: boolean; lat: number | null; lng: number | null; radius: number }>({ enabled: false, lat: null, lng: null, radius: 150 });
  const [workspace, setWorkspace] = useState<{ name: string; logo: string | null }>({ name: '', logo: null });
  const [attendanceAudit, setAttendanceAudit] = useState<AttendanceAudit>(() => ({ location: null, ip: null, device: getDeviceInfo() }));

  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState<string | null>(null);

  // Android hardware back: close an open overlay → return to the Home tab →
  // only then minimise the app (send to background, never exit to the OS).
  const tabRef = useRef(tab);
  const overlayRef = useRef(overlay);
  tabRef.current = tab;
  overlayRef.current = overlay;
  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => void } | undefined;
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('backButton', () => {
        if (overlayRef.current) setOverlay(null);
        else if (tabRef.current !== 'home') setTab('home');
        else void App.minimizeApp();
      }).then((h) => { handle = h; });
    });
    return () => { handle?.remove(); };
  }, []);
  const [status, setStatus] = useState<Status>('out');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null);
  // Demo sample data is for the unconfigured marketing build only. A configured
  // app (web live / APK) must NEVER show it — even during the cold-start window
  // before the profile/orgId resolves — or it flickers demo → real data.
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(configured ? [] : INITIAL_LEAVE);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>(configured ? [] : INITIAL_TEAM);

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
      const [leaveRows, attRows, balances, holidayRows, today, approvals, reimbRows, billing, annRows, annReads, orgSettings] = await Promise.all([
        myLeave(profile, emp),
        listMyAttendance(orgId, emp),
        myLeaveBalances(orgId, emp),
        listHolidays(),
        getTodayAttendance(orgId, emp, currentDay),
        role === 'manager' ? listMyTeamLeave(profile, emp)
          : (role === 'hr' || role === 'owner') ? listLeave()
          : Promise.resolve([]),
        myReimbursements().catch(() => [] as Reimbursement[]),
        fetchBilling(orgId).catch(() => null),
        listAnnouncements().catch(() => [] as Announcement[]),
        listAnnouncementReads().catch(() => []),
        getOrganizationSettings(orgId).catch(() => ({} as Record<string, unknown>)),
      ]);
      const ap = ((orgSettings as Record<string, unknown>).attendancePolicy ?? {}) as { geofence?: number; geo?: boolean; officeLat?: number; officeLng?: number };
      setGeo({ enabled: !!ap.geo && ap.officeLat != null && ap.officeLng != null, lat: ap.officeLat ?? null, lng: ap.officeLng ?? null, radius: Number(ap.geofence) || 150 });
      setLeaveRequests(leaveRows.map(mapLeave));
      setAttendanceRows(attRows);
      // Comp-off balance = earned extra-work days (weekend/holiday attendance,
      // all-time) − Comp off leave used/pending. Surfaced as a leave balance.
      const earnedComp = await compOffEarned(emp, holidayRows.map((h) => h.date), weekendConfigFrom(billing)).catch(() => 0);
      const compUsed = leaveRows.filter((l) => l.type?.toLowerCase() === 'comp off' && l.status === 'Approved').reduce((a, l) => a + Number(l.days || 0), 0);
      const compPending = leaveRows.filter((l) => l.type?.toLowerCase() === 'comp off' && l.status === 'Pending').reduce((a, l) => a + Number(l.days || 0), 0);
      setLeaveBalances(earnedComp > 0 || compUsed > 0 || compPending > 0
        ? [...balances, { type: 'Comp off', allotted: earnedComp, used: compUsed, pending: compPending, available: Math.max(0, earnedComp - compUsed - compPending) }]
        : balances);
      setHolidays(holidayRows);
      setTeamRows(approvals);
      setTeamRequests(approvals.map((r) => mapTeamLeave(r, role === 'manager')));
      setReimbursements(reimbRows);
      setReimbState({ enabled: billing ? reimbursementActive(billing) : false, requireManager: billing?.reimbursement_require_manager ?? true });
      setWorkspace({ name: billing?.display_name || billing?.name || '', logo: billing?.logo_url ?? null });
      setAnnouncements(annRows);
      setReadAnnIds(new Set(annReads.map((r) => r.announcement_id)));
      if (today) setAttendanceAudit({ location: today.location, ip: today.ip, device: today.device || getDeviceInfo() });
      applyTodayState(today);
    } catch (e) {
      console.error(e);
    }
  }, [applyTodayState, canApproveTeam, role, currentDay, live, orgId, profile]);

  // Ask for camera + photo access once on native, so capturing/attaching
  // receipts and saving exports works without a mid-action permission stall.
  useEffect(() => { void requestAppPermissions(); void initPush(); }, []);

  useEffect(() => { void reloadLive(); }, [reloadLive]);
  // Live updates: refresh when leave/attendance change for this tenant.
  useEffect(() => {
    if (!live) return;
    return onTablesChange(['leave_requests', 'attendance', 'reimbursements', 'announcements'], () => { void reloadLive(); });
  }, [live, reloadLive]);

  // Notifications (live).
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const loadNotifications = useCallback(async () => {
    if (!live) { setNotifications([]); return; }
    try { setNotifications(await listNotifications()); } catch (e) { console.error(e); }
  }, [live]);
  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    if (!live) return;
    return onTablesChange(['notifications'], () => { void loadNotifications(); });
  }, [live, loadNotifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAllRead = () => { void markAllNotificationsRead().then(loadNotifications).catch(console.error); };
  const markOneRead = (id: string) => { void markNotificationRead(id).then(loadNotifications).catch(console.error); };
  useEffect(() => {
    // Only the unconfigured demo build seeds sample data; a configured app shows
    // empty state while live data loads, never demo content.
    if (configured) return;
    setEmployee(null);
    setAttendanceRows([]);
    setLeaveBalances([]);
    setHolidays([]);
    setTeamRows([]);
    setLeaveRequests(INITIAL_LEAVE);
    setTeamRequests(INITIAL_TEAM);
    setReimbursements([]);
    setReimbState({ enabled: false, requireManager: true });
    setAnnouncements([]);
    setReadAnnIds(new Set());
    setGeo({ enabled: false, lat: null, lng: null, radius: 150 });
    setWorkspace({ name: '', logo: null });
  }, [configured]);

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
    live, configured, employee, employeeName: empName, workspaceName: workspace.name, workspaceLogo: workspace.logo, attendanceRows, leaveBalances, holidays, weeklyHours: weeklyHours(attendanceRows),
    attendanceAudit, refreshAttendanceAudit,
    timeSynced: clock.synced, timeSource: clock.source,
    fmtClock, fmtDur,
    openOverlay: setOverlay, closeOverlay: () => setOverlay(null),
    notify: (text: string, icon = 'checkCircle') => showToast(text, icon),
    doCheckIn: (audit = attendanceAudit) => {
      // Location is compulsory for an entry — block and prompt if it's missing.
      if (!audit.location) { showToast(locationMessage(audit.locationError ?? null), 'x'); return; }
      // Geofence: block check-ins outside the office radius when the org enforces it.
      if (geo.enabled && geo.lat != null && geo.lng != null) {
        if (audit.lat == null || audit.lng == null) { showToast('Turn on precise location to check in at this office.', 'x'); return; }
        const dist = distanceMeters(audit.lat, audit.lng, geo.lat, geo.lng);
        if (dist > geo.radius) { showToast(`You're ${Math.round(dist)} m from the office (limit ${geo.radius} m). Move closer to check in.`, 'x'); return; }
      }
      void getPunchTime().then((localTime) => {
        if (!localTime) { showToast('You are not connected to the internet', 'x'); return; }
        setCheckInTime(localTime); setCheckOutTime(null); setStatus('in'); setOverlay(null); showToast('Checked in at ' + fmtClock(localTime));
        if (live && orgId) {
          checkIn(orgId, employee, { checkedAt: localTime.toISOString(), location: audit.location || undefined, ip: audit.ip || undefined, device: audit.device, lat: audit.lat ?? undefined, lng: audit.lng ?? undefined })
            .then((row) => { setAttendanceId(row.id); setAttendanceRows((rows) => mergeAttendance(rows, row)); applyTodayState(row); })
            .catch(console.error);
        }
      });
    },
    doCheckOut: (audit = attendanceAudit) => {
      // Location is compulsory for check-out too — block and prompt if missing.
      if (!audit.location) { showToast(locationMessage(audit.locationError ?? null), 'x'); return; }
      void getPunchTime().then((out) => {
        if (!out) { showToast('You are not connected to the internet', 'x'); return; }
        const seconds = checkInTime ? (out.getTime() - checkInTime.getTime()) / 1000 : 0;
        setCheckOutTime(out); setStatus('done'); setOverlay(null); showToast('Checked out at ' + fmtClock(out));
        if (live && attendanceId) checkOut(attendanceId, seconds, { checkedAt: out.toISOString(), location: audit.location || undefined, ip: audit.ip || undefined, device: audit.device, lat: audit.lat ?? undefined, lng: audit.lng ?? undefined }).then(reloadLive).catch(console.error);
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
    cancelLeave: (id) => {
      if (!live) { showToast('Connect your workspace first', 'x'); return; }
      apiCancelLeave(id).then(() => reloadLive()).then(() => showToast('Leave request withdrawn', 'leave'))
        .catch((err) => { console.error(err); showToast('Could not withdraw request', 'x'); });
    },
    teamRequests,
    approveTeam: (id) => {
      const row = teamRows.find((x) => x.id === id);
      if (live && row) {
        const decide = role === 'manager' ? decideTeamLeave : decideLeave;
        const note = role === 'manager' && row.stage === 'manager' ? `${row.emp || 'Employee'} leave forwarded to HR` : `${row.emp || 'Employee'} leave approved`;
        decide(row, 'approve').then(reloadLive).then(() => showToast(note)).catch((err) => {
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
        const decide = role === 'manager' ? decideTeamLeave : decideLeave;
        decide(row, 'reject').then(reloadLive).then(() => showToast(`${row.emp || 'Employee'} leave rejected`, 'x')).catch((err) => {
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
    notifications, unreadCount, markAllRead, markOneRead,
    reimbursements,
    reimbursementEnabled: reimbState.enabled,
    submitReimbursement: (d) => {
      if (!d.amount || d.amount <= 0) { showToast('Enter a valid amount', 'x'); return; }
      if (!live || !orgId) { showToast('Connect your workspace to submit claims', 'x'); return; }
      setOverlay(null);
      applyReimbursement(orgId, {
        employee, empName, category: d.category, amount: d.amount, spentOn: d.spentOn,
        reason: d.reason, files: d.files, requireManager: reimbState.requireManager,
      })
        .then(() => reloadLive())
        .then(() => showToast('Reimbursement claim submitted', 'checkCircle'))
        .catch((err) => { console.error(err); showToast(err instanceof Error ? err.message : 'Could not submit claim', 'x'); void reloadLive(); });
    },
    cancelReimbursement: (id) => {
      if (!live) { showToast('Connect your workspace first', 'x'); return; }
      apiCancelReimbursement(id).then(() => reloadLive()).then(() => showToast('Claim withdrawn', 'checkCircle'))
        .catch((err) => { console.error(err); showToast('Could not withdraw claim', 'x'); });
    },
    announcements,
    unreadAnnouncements: announcements.filter((a) => !readAnnIds.has(a.id)).length,
    isAnnouncementRead: (id: string) => readAnnIds.has(id),
    markAnnouncementRead: (id: string) => {
      if (readAnnIds.has(id)) return;
      setReadAnnIds((prev) => new Set(prev).add(id));
      if (live) void markAnnouncementRead(id).catch(console.error);
    },
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
        {overlay === 'reimbursements' && <ReimbursementsScreen ctx={ctx} />}
        {overlay === 'announcements' && <AnnouncementsScreen ctx={ctx} />}
        {overlay === 'notifications' && <NotificationsScreen ctx={ctx} />}
        {overlay === 'logout' && <LogoutConfirm onCancel={ctx.closeOverlay} onConfirm={ctx.logout} />}

        <Toast show={!!toast} text={toast?.text} icon={toast?.icon || 'checkCircle'} />
      </div>
    </PhoneFrame>
  );
}
