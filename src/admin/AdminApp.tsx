import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ADMIN_VARS } from './theme';
import {
  AIcon, AAvatar, ACard, APill, ABadge, KPI, Segmented, AToast, BtnGhost, BtnPrimary, PageHead, Spinner,
} from './ui';
import {
  listEmployees, addEmployee, deleteEmployee, listLeave, decideLeave, listHolidays, addHoliday, deleteHoliday,
  dashboardStats, hasEmployees, seedSampleData, getOrganization, updateOrganization, listReimbursements,
  listAnnouncements, listAnnouncementReads,
  type Employee, type LeaveRow, type Holiday, type Stats, type Reimbursement, type Announcement, type AnnouncementRead,
} from '../lib/api';
import { fetchExportData, downloadWorkbook, downloadWorkbookServer, SHEETS, type ExportData } from '../lib/export';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from '../lib/api';
import { onTablesChange, onTableChange } from '../lib/realtime';
import { fetchBilling, startCheckout, listPayments, planFor, seatLimit, periodDaysLeft, atSeatLimit, isPaid, quoteFor, rateFor, fmtINR, TIERS, FREE_SEAT_LIMIT, REIMBURSEMENT_RATE, addonAnnual, reimbursementActive, reimbursementEntitled, type OrgBilling, type PaymentRow } from '../lib/billing';
import Settings from './Settings';
import { AttendanceMIS, PayrollMIS } from './mis';
import { Reimbursements } from './reimbursements';
import { Announcements } from './announcements';
import { weekendConfigFrom } from '../lib/calendar';

const LEAVE_ICON: Record<string, string> = { Casual: 'coffee', Sick: 'umbrella', Paid: 'briefcase', 'Work from home': 'house', Unpaid: 'calendar' };
const fmtRange = (a: string | null, b: string | null) => {
  const f = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
  return a === b ? f(a) : `${f(a)} – ${f(b)}`;
};

type Page = 'dashboard' | 'approvals' | 'employees' | 'attendance' | 'holidays' | 'payroll' | 'reimbursements' | 'announcements' | 'reports' | 'settings' | 'billing';
const NAV: { id: Page; icon: string; label: string }[] = [
  { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
  { id: 'approvals', icon: 'inbox', label: 'Leave Approvals' },
  { id: 'employees', icon: 'users', label: 'Employees' },
  { id: 'attendance', icon: 'clock', label: 'Attendance MIS' },
  { id: 'holidays', icon: 'calendar', label: 'Holidays' },
  { id: 'payroll', icon: 'briefcase', label: 'Payroll' },
  { id: 'reimbursements', icon: 'receipt', label: 'Reimbursements' },
  { id: 'announcements', icon: 'bell', label: 'Announcements' },
  { id: 'reports', icon: 'download', label: 'Reports & export' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
  { id: 'billing', icon: 'wallet', label: 'Billing' },
];

export default function AdminApp() {
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const orgId = profile?.org_id ?? null;
  const canManage = role === 'owner' || role === 'hr';

  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [billing, setBilling] = useState<OrgBilling | null>(null);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementReads, setAnnouncementReads] = useState<AnnouncementRead[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: string; icon: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');

  const fire = (text: string, tone = 'green', icon = 'checkCircle') => { setToast({ text, tone, icon }); setTimeout(() => setToast(null), 2600); };

  const reload = useCallback(async () => {
    const [emp, lv, hol, st, bill, reimb, anns, annReads] = await Promise.all([
      listEmployees(), listLeave(), listHolidays(), dashboardStats(),
      orgId ? fetchBilling(orgId) : Promise.resolve(null),
      listReimbursements().catch(() => [] as Reimbursement[]),
      listAnnouncements().catch(() => [] as Announcement[]),
      listAnnouncementReads().catch(() => [] as AnnouncementRead[]),
    ]);
    setEmployees(emp); setLeave(lv); setHolidays(hol); setStats(st); setBilling(bill); setReimbursements(reimb);
    setAnnouncements(anns); setAnnouncementReads(annReads);
  }, [orgId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try { await reload(); } catch (e) { console.error(e); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reload]);

  // Live updates: refresh whenever leave/attendance/employees change anywhere.
  useEffect(() => onTablesChange(['leave_requests', 'attendance', 'employees', 'reimbursements', 'announcements'], () => { void reload(); }), [reload]);

  const onSeed = async () => {
    if (!orgId) return;
    setSeeding(true);
    try {
      if (!(await hasEmployees())) await seedSampleData(orgId);
      await reload();
      fire('Sample data loaded');
    } catch (e) { console.error(e); fire('Could not load sample data', 'red', 'xCircle'); }
    finally { setSeeding(false); }
  };

  const onDecide = async (row: LeaveRow, action: 'approve' | 'reject') => {
    try {
      await decideLeave(row, action);
      await reload();
      fire(action === 'approve' ? `${row.emp}'s leave ${row.stage === 'manager' ? 'forwarded to HR' : 'approved'}` : `${row.emp}'s leave rejected`, action === 'approve' ? 'green' : 'red', action === 'approve' ? 'checkCircle' : 'xCircle');
    } catch (e) { console.error(e); fire('Action failed', 'red', 'xCircle'); }
  };

  const onAddEmployee = async (e: Partial<Employee>) => {
    if (!orgId) return;
    if (billing && atSeatLimit(billing, employees.length)) {
      fire(`Seat limit reached on the ${planFor(billing).name} plan — upgrade to add more`, 'amber', 'wallet');
      setPage('billing');
      return;
    }
    try { await addEmployee(orgId, e); await reload(); fire('Employee added'); }
    catch (err) { console.error(err); fire('Could not add employee', 'red', 'xCircle'); }
  };
  const onDeleteEmployee = async (id: string) => {
    try { await deleteEmployee(id); await reload(); fire('Employee removed', 'red', 'trash'); }
    catch (e) { console.error(e); fire('Delete failed', 'red', 'xCircle'); }
  };

  const onAddHoliday = async (h: Omit<Holiday, 'id'>) => {
    if (!orgId) return;
    try { await addHoliday(orgId, h); await reload(); fire('Holiday added'); }
    catch (e) { console.error(e); fire('Could not add holiday', 'red', 'xCircle'); }
  };
  const onDeleteHoliday = async (id: string) => {
    try { await deleteHoliday(id); await reload(); fire('Holiday removed', 'red', 'trash'); }
    catch (e) { console.error(e); fire('Delete failed', 'red', 'xCircle'); }
  };

  const q = search.trim().toLowerCase();
  const matches = (...values: Array<string | null | undefined>) => !q || values.some((v) => String(v ?? '').toLowerCase().includes(q));
  const shownEmployees = employees.filter((e) => matches(e.name, e.code, e.dept, e.designation, e.manager, e.email));
  const shownLeave = leave.filter((l) => matches(l.emp, l.code, l.dept, l.type, l.status, l.reason));
  const shownHolidays = holidays.filter((h) => matches(h.name, h.type, h.description));
  const pendingCount = leave.filter((l) => l.status === 'Pending').length;

  return (
    <div style={{ display: 'flex', height: '100vh', ...ADMIN_VARS, background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* SIDEBAR */}
      <aside style={{ width: 250, flexShrink: 0, background: 'var(--side-bg)', borderRight: '1px solid var(--side-line)', display: 'flex', flexDirection: 'column', padding: '22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 22px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(140deg, var(--accent), var(--accent-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AIcon name="check" size={20} color="#fff" sw={2.8} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Attendly</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.filter((it) => it.id !== 'reimbursements' || !billing || reimbursementActive(billing)).map((it) => {
            const on = page === it.id;
            return (
              <button key={it.id} onClick={() => setPage(it.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: on ? 'var(--side-active-bg)' : 'transparent',
                color: on ? 'var(--side-active-ink)' : 'var(--side-ink)', fontWeight: on ? 700 : 600, fontSize: 14,
              }}>
                <AIcon name={it.icon} size={20} color={on ? 'var(--accent)' : 'var(--side-dim)'} sw={on ? 2 : 1.8} />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.id === 'approvals' && pendingCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px', minWidth: 20, textAlign: 'center' }}>{pendingCount}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 11, padding: '10px 8px', borderRadius: 12, background: 'var(--side-hover)' }}>
          <AAvatar name={profile?.full_name || 'You'} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--side-active-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name || 'You'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--side-dim)', textTransform: 'capitalize' }}>{role}</div>
          </div>
          <button onClick={() => void signOut().then(() => navigate('/'))} title="Sign out" style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
            <AIcon name="logout" size={17} color="var(--side-dim)" />
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 66, flexShrink: 0, background: 'var(--panel)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 11, background: 'var(--bg)', width: 320, maxWidth: '40%' }}>
            <AIcon name="search" size={18} color="var(--ink-3)" />
            <input placeholder="Search employees, requests..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: 'none', outline: 'none', background: 'none', fontSize: 13.5, color: 'var(--ink-1)', width: '100%' }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <NotificationBell />
            <div style={{ width: 1, height: 28, background: 'var(--line)' }} />
            <AAvatar name={profile?.full_name || 'You'} size={36} />
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {loading ? <Spinner label="Loading your workspace…" />
            : page === 'billing' ? (
              <Billing billing={billing} seatsUsed={employees.length} canManage={canManage} onToast={fire} onRefresh={() => { void reload(); }} />
            ) : page === 'reports' ? (
              <Reports orgId={orgId} onToast={fire} />
            ) : page === 'settings' ? (
              <Settings orgId={orgId} canManage={canManage} onToast={fire} onGoBilling={() => setPage('billing')} />
            ) : page === 'attendance' ? (
              <AttendanceMIS orgId={orgId} employees={employees} leave={leave} holidays={holidays} weekend={weekendConfigFrom(billing)} />
            ) : page === 'payroll' ? (
              <PayrollMIS orgId={orgId} employees={employees} leave={leave} holidays={holidays} weekend={weekendConfigFrom(billing)} canManage={canManage} onToast={fire} />
            ) : page === 'reimbursements' ? (
              <Reimbursements rows={reimbursements} role={role} billing={billing} onChanged={() => { void reload(); }} onToast={fire} onGoBilling={() => setPage('billing')} />
            ) : page === 'announcements' ? (
              <Announcements orgId={orgId} rows={announcements} reads={announcementReads} memberCount={employees.length} role={role} authorName={profile?.full_name || 'Admin'} onChanged={() => { void reload(); }} onToast={fire} />
            ) : !canManage && employees.length === 0 ? <EmptyManager />
            : employees.length === 0 && leave.length === 0 ? (
              <EmptyState seeding={seeding} canSeed={canManage} onSeed={onSeed} />
            ) : page === 'approvals' ? (
              <Approvals leave={shownLeave} role={role} onDecide={onDecide} />
            ) : page === 'employees' ? (
              <Employees employees={shownEmployees} canManage={canManage} onAdd={onAddEmployee} onDelete={onDeleteEmployee} />
            ) : page === 'holidays' ? (
              <Holidays holidays={shownHolidays} canManage={canManage} onAdd={onAddHoliday} onDelete={onDeleteHoliday} />
            ) : (
              <Dashboard stats={stats} leave={shownLeave} reimbursements={reimbursements} reimbEnabled={!!billing && reimbursementActive(billing)} announcements={announcements} announcementReads={announcementReads} memberCount={employees.length} canManage={canManage} onGo={setPage} onDecide={onDecide} />
            )}
        </main>
      </div>

      <AToast show={!!toast} text={toast?.text} tone={toast?.tone} icon={toast?.icon} />
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────
function EmptyState({ seeding, canSeed, onSeed }: { seeding: boolean; canSeed: boolean; onSeed: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: '60px auto 0', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AIcon name="sparkles" size={30} color="var(--accent)" sw={1.9} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em', margin: '20px 0 8px' }}>Your workspace is ready</h1>
      <p style={{ margin: '0 auto 22px', maxWidth: 400, fontSize: 14.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        There's no data yet. {canSeed ? 'Load a realistic sample team to explore the admin console, or add your own employees.' : 'Ask an Owner or HR admin to add employees.'}
      </p>
      {canSeed && <BtnPrimary icon="sparkles" onClick={onSeed} disabled={seeding}>{seeding ? 'Loading…' : 'Load sample data'}</BtnPrimary>}
    </div>
  );
}
function EmptyManager() {
  return (
    <div style={{ maxWidth: 520, margin: '60px auto 0', textAlign: 'center', color: 'var(--ink-3)' }}>
      <AIcon name="users" size={40} color="var(--ink-3)" />
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-1)', margin: '16px 0 6px' }}>Nothing to manage yet</h1>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>Once your team is added, employees and requests appear here.</p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ stats, leave, reimbursements, reimbEnabled, announcements, announcementReads, memberCount, canManage, onGo, onDecide }: { stats: Stats | null; leave: LeaveRow[]; reimbursements: Reimbursement[]; reimbEnabled: boolean; announcements: Announcement[]; announcementReads: AnnouncementRead[]; memberCount: number; canManage: boolean; onGo: (p: Page) => void; onDecide: (r: LeaveRow, a: 'approve' | 'reject') => void }) {
  const pending = leave.filter((l) => l.status === 'Pending');
  const showReimb = reimbEnabled; // hidden entirely when the add-on is off
  const reimbPending = reimbursements.filter((r) => r.status === 'Pending');
  const reimbApproved = reimbursements.filter((r) => r.status === 'Approved');
  const awaitingPayout = reimbApproved.reduce((a, r) => a + Number(r.amount || 0), 0);
  const paidTotal = reimbursements.filter((r) => r.status === 'Paid').reduce((a, r) => a + Number(r.amount || 0), 0);
  const annReadCount = (id: string) => new Set(announcementReads.filter((r) => r.announcement_id === id).map((r) => r.user_id)).size;
  const annDenom = Math.max(0, memberCount - 1);
  return (
    <div>
      <PageHead title="Dashboard" sub={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <KPI icon="users" label="Total employees" value={stats?.employees ?? 0} tone="accent" />
        <KPI icon="checkCircle" label="Present today" value={stats?.presentToday ?? 0} tone="green" />
        <KPI icon="calendarClock" label="Active" value={stats?.active ?? 0} tone="purple" />
        <KPI icon="grid" label="Departments" value={stats?.departments ?? 0} tone="amber" />
        <KPI icon="inbox" label="Pending approvals" value={stats?.pendingLeave ?? 0} tone="amber" onClick={() => onGo('approvals')} />
      </div>

      {showReimb && (
        <div style={{ marginTop: 16 }}>
          <ACard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <AIcon name="receipt" size={18} color="var(--accent)" />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Reimbursements</div>
              </div>
              <button onClick={() => onGo('reimbursements')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Review <AIcon name="chevronRight" size={15} color="var(--accent)" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, background: 'var(--line)', borderTop: '1px solid var(--line)' }}>
              {([
                ['Pending approval', String(reimbPending.length), 'var(--amber)'],
                ['Awaiting payout', fmtINR(awaitingPayout), 'var(--accent)'],
                ['Claims to pay', String(reimbApproved.length), 'var(--ink-1)'],
                ['Paid (total)', fmtINR(paidTotal), 'var(--green)'],
              ] as const).map(([label, value, color]) => (
                <div key={label} style={{ background: 'var(--panel)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, color, marginTop: 4, letterSpacing: '-0.01em' }}>{value}</div>
                </div>
              ))}
            </div>
            {reimbApproved.length > 0 && (
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AIcon name="wallet" size={15} color="var(--accent)" />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{reimbApproved.length} claim{reimbApproved.length === 1 ? '' : 's'} approved — download the ZIP report and process {fmtINR(awaitingPayout)}.</span>
                <button onClick={() => onGo('reimbursements')} style={{ marginLeft: 'auto', border: 'none', background: 'var(--accent-soft)', color: 'var(--accent-deep)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}>Process payouts</button>
              </div>
            )}
          </ACard>
        </div>
      )}

      {(announcements.length > 0 || canManage) && (
        <div style={{ marginTop: 16 }}>
          <ACard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <AIcon name="bell" size={18} color="var(--accent)" />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Announcements</div>
              </div>
              <button onClick={() => onGo('announcements')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>{canManage ? 'Post' : 'View all'} <AIcon name="chevronRight" size={15} color="var(--accent)" /></button>
            </div>
            {announcements.length === 0 ? (
              <div style={{ padding: '8px 22px 22px', color: 'var(--ink-3)', fontSize: 13.5 }}>No announcements yet — share a company-wide update with your team.</div>
            ) : announcements.slice(0, 3).map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderTop: '1px solid var(--line)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AIcon name={a.pinned ? 'arrowUp' : 'bell'} size={16} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.author || 'Admin'} · {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                {annDenom > 0 && <APill tone="neutral"><AIcon name="checkCircle" size={12} color="var(--ink-2)" />{annReadCount(a.id)} / {annDenom} read</APill>}
              </div>
            ))}
          </ACard>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ACard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Pending approvals</div>
            <button onClick={() => onGo('approvals')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>View all <AIcon name="chevronRight" size={15} color="var(--accent)" /></button>
          </div>
          {pending.length === 0 && <div style={{ padding: '8px 22px 22px', color: 'var(--ink-3)', fontSize: 13.5 }}>You're all caught up — no pending requests.</div>}
          {pending.slice(0, 6).map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderTop: '1px solid var(--line)' }}>
              <AAvatar name={r.emp || '?'} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)' }}>{r.emp}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.type} · {fmtRange(r.from_date, r.to_date)} · {r.days}d</div>
              </div>
              <button onClick={() => onDecide(r, 'approve')} title="Approve" style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--green-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AIcon name="check" size={17} color="var(--green)" sw={2.4} />
              </button>
            </div>
          ))}
        </ACard>
      </div>
    </div>
  );
}

// ── Leave Approvals ───────────────────────────────────────────────────
function Approvals({ leave, role, onDecide }: { leave: LeaveRow[]; role: string; onDecide: (r: LeaveRow, a: 'approve' | 'reject') => void }) {
  const [tab, setTab] = useState('Pending');
  const filtered = leave.filter((r) => (tab === 'All' ? true : r.status === tab));
  const pendingCount = leave.filter((r) => r.status === 'Pending').length;
  const canDecideRequest = (r: LeaveRow) => role === 'manager' ? r.stage === 'manager' : (role === 'owner' || role === 'hr') && r.stage !== 'manager';
  return (
    <div>
      <PageHead title="Leave Approvals" sub={`${pendingCount} request${pendingCount === 1 ? '' : 's'} awaiting action`} />
      <div style={{ marginBottom: 16 }}>
        <Segmented options={[{ value: 'Pending', label: 'Pending', n: pendingCount }, 'Approved', 'Rejected', 'All']} value={tab} onChange={setTab} />
      </div>
      {filtered.length === 0 ? (
        <ACard style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No {tab.toLowerCase()} requests.</ACard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map((r) => (
            <ACard key={r.id} pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <AAvatar name={r.emp || '?'} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{r.emp}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.dept} · {r.code}</div>
                </div>
                <ABadge status={r.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <APill tone="neutral"><AIcon name={LEAVE_ICON[r.type] || 'calendar'} size={13} color="var(--ink-2)" />{r.type}</APill>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600 }}>{r.half ? fmtRange(r.from_date, r.from_date) + ' · ½' : fmtRange(r.from_date, r.to_date)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{r.days}d</span>
              </div>
              {r.reason && <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, marginTop: 10 }}>{r.reason}</div>}
              {r.status === 'Pending' ? (
                canDecideRequest(r) && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button onClick={() => onDecide(r, 'reject')} style={{ flex: 1, height: 42, borderRadius: 11, border: '1.5px solid var(--red)', background: 'var(--panel)', color: 'var(--red)', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><AIcon name="x" size={17} color="var(--red)" sw={2.2} />Reject</button>
                    <button onClick={() => onDecide(r, 'approve')} style={{ flex: 1.6, height: 42, borderRadius: 11, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><AIcon name="check" size={17} color="#fff" sw={2.4} />{r.stage === 'manager' ? 'Approve → HR' : 'Approve'}</button>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--line)', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600 }}>
                  <AIcon name={r.status === 'Approved' ? 'checkCircle' : 'xCircle'} size={15} color={r.status === 'Approved' ? 'var(--green)' : 'var(--red)'} />
                  {r.status}
                </div>
              )}
            </ACard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Employees ─────────────────────────────────────────────────────────
const td: CSSProperties = { padding: '13px 18px', borderBottom: '1px solid var(--line)', fontSize: 13.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' };
function Employees({ employees, canManage, onAdd, onDelete }: { employees: Employee[]; canManage: boolean; onAdd: (e: Partial<Employee>) => void; onDelete: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHead title="Employees" sub={`${employees.length} ${employees.length === 1 ? 'person' : 'people'}`}>
        {canManage && <BtnPrimary icon="plus" onClick={() => setAdding(true)}>Add employee</BtnPrimary>}
      </PageHead>
      <ACard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr>{['Employee', 'Department', 'Designation', 'Type', 'Reporting to', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={e.name} size={36} /><div><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)' }}>{e.name}</div><div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{e.code}</div></div></div></td>
                  <td style={td}>{e.dept || '—'}</td>
                  <td style={td}>{e.designation || '—'}</td>
                  <td style={td}><APill tone="neutral">{e.type || '—'}</APill></td>
                  <td style={td}>{e.manager || '—'}</td>
                  <td style={td}><ABadge status={e.status} /></td>
                  <td style={{ ...td, textAlign: 'right' }}>{canManage && <button onClick={() => onDelete(e.id)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6 }}><AIcon name="trash" size={17} color="var(--ink-3)" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ACard>
      {adding && <AddEmployeeModal onClose={() => setAdding(false)} onSave={(e) => { onAdd(e); setAdding(false); }} />}
    </div>
  );
}

function AddEmployeeModal({ onClose, onSave }: { onClose: () => void; onSave: (e: Partial<Employee>) => void }) {
  const [f, setF] = useState<Partial<Employee>>({ code: '', name: '', dept: '', designation: '', manager: '', type: 'Full-time', status: 'Active', email: '', phone: '' });
  const u = (k: keyof Employee, v: string) => setF((s) => ({ ...s, [k]: v }));
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 10, border: '1px solid var(--line)', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink-1)', outline: 'none' };
  const lbl: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 };
  const save = () => { if (!f.code?.trim() || !f.name?.trim()) return; onSave(f); };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,34,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', background: 'var(--panel)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-1)' }}>Add employee</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--soft)', cursor: 'pointer' }}><AIcon name="x" size={17} color="var(--ink-2)" /></button>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label><span style={lbl}>Emp code *</span><input style={input} value={f.code || ''} onChange={(e) => u('code', e.target.value)} placeholder="CTK-1001" /></label>
          <label><span style={lbl}>Name *</span><input style={input} value={f.name || ''} onChange={(e) => u('name', e.target.value)} placeholder="Full name" /></label>
          <label><span style={lbl}>Department</span><input style={input} value={f.dept || ''} onChange={(e) => u('dept', e.target.value)} placeholder="Engineering" /></label>
          <label><span style={lbl}>Designation</span><input style={input} value={f.designation || ''} onChange={(e) => u('designation', e.target.value)} placeholder="Engineer" /></label>
          <label><span style={lbl}>Reporting to</span><input style={input} value={f.manager || ''} onChange={(e) => u('manager', e.target.value)} placeholder="Manager name" /></label>
          <label><span style={lbl}>Type</span>
            <select style={{ ...input, appearance: 'none' }} value={f.type || 'Full-time'} onChange={(e) => u('type', e.target.value)}>
              {['Full-time', 'Part-time', 'Contract'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label><span style={lbl}>Work email</span><input style={input} value={f.email || ''} onChange={(e) => u('email', e.target.value)} placeholder="name@company.com" /></label>
          <label><span style={lbl}>Phone</span><input style={input} value={f.phone || ''} onChange={(e) => u('phone', e.target.value)} placeholder="+91 …" /></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary icon="plus" onClick={save}>Add employee</BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// ── Holidays ──────────────────────────────────────────────────────────
function Holidays({ holidays, canManage, onAdd, onDelete }: { holidays: Holiday[]; canManage: boolean; onAdd: (h: Omit<Holiday, 'id'>) => void; onDelete: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const tone: Record<string, 'accent' | 'purple' | 'amber'> = { National: 'accent', Festival: 'purple', Optional: 'amber' };
  return (
    <div>
      <PageHead title="Holidays" sub={`${holidays.length} holidays`}>
        {canManage && <BtnPrimary icon="plus" onClick={() => setAdding(true)}>Add holiday</BtnPrimary>}
      </PageHead>
      {holidays.length === 0 ? (
        <ACard style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5 }}>No holidays yet.</ACard>
      ) : (
        <ACard pad={0} style={{ overflow: 'hidden' }}>
          {holidays.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '14px 18px', borderBottom: i < holidays.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div style={{ width: 50, height: 50, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{new Date(h.date + 'T00:00:00').getDate()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>{h.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}{h.description ? ` - ${h.description}` : ''}</div>
              </div>
              <APill tone={tone[h.type] || 'neutral'}>{h.type}</APill>
              {canManage && <button onClick={() => onDelete(h.id)} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6 }}><AIcon name="trash" size={17} color="var(--ink-3)" /></button>}
            </div>
          ))}
        </ACard>
      )}
      {adding && <AddHolidayModal onClose={() => setAdding(false)} onSave={(h) => { onAdd(h); setAdding(false); }} />}
    </div>
  );
}

function AddHolidayModal({ onClose, onSave }: { onClose: () => void; onSave: (h: Omit<Holiday, 'id'>) => void }) {
  const [f, setF] = useState<Omit<Holiday, 'id'>>({ name: '', date: new Date().toISOString().slice(0, 10), type: 'National', description: '' });
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 10, border: '1px solid var(--line)', padding: '0 12px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink-1)', outline: 'none' };
  const lbl: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 };
  const update = (k: keyof Omit<Holiday, 'id'>, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = () => { if (!f.name.trim() || !f.date) return; onSave({ ...f, name: f.name.trim(), description: f.description?.trim() || null }); };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,34,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', background: 'var(--panel)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-1)' }}>Add holiday</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--soft)', cursor: 'pointer' }}><AIcon name="x" size={17} color="var(--ink-2)" /></button>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Name *</span><input style={input} value={f.name} onChange={(e) => update('name', e.target.value)} placeholder="Diwali" /></label>
          <label><span style={lbl}>Date *</span><input type="date" style={input} value={f.date} onChange={(e) => update('date', e.target.value)} /></label>
          <label><span style={lbl}>Type</span><select style={{ ...input, appearance: 'none' }} value={f.type} onChange={(e) => update('type', e.target.value)}>{['National', 'Festival', 'Optional'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label style={{ gridColumn: '1 / -1' }}><span style={lbl}>Description</span><input style={input} value={f.description || ''} onChange={(e) => update('description', e.target.value)} placeholder="Optional note" /></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <BtnGhost onClick={onClose}>Cancel</BtnGhost>
          <BtnPrimary icon="plus" onClick={save}>Add holiday</BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// Reports & export ──────────────────────────────────────────────────
function Reports({ orgId, onToast }: { orgId: string | null; onToast: (t: string, tone?: string, icon?: string) => void }) {
  const [data, setData] = useState<ExportData | null>(null);
  const [orgName, setOrgName] = useState('Attendly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [d, org] = await Promise.all([fetchExportData(), orgId ? getOrganization(orgId) : Promise.resolve(null)]);
        if (!active) return;
        setData(d);
        if (org) setOrgName(org.display_name || org.name);
      } catch (e) { console.error(e); }
    })();
    return () => { active = false; };
  }, [orgId]);

  const onDownload = async () => {
    setBusy(true);
    try {
      try {
        // Prefer the server-side Edge Function (scales to large datasets)…
        await downloadWorkbookServer(orgName);
      } catch {
        // …fall back to building it in the browser if it's not deployed.
        const d = await fetchExportData();
        downloadWorkbook(d, orgName);
      }
      onToast('Workbook downloaded');
    } catch (e) { console.error(e); onToast('Export failed', 'red', 'xCircle'); }
    finally { setBusy(false); }
  };

  const total = data ? SHEETS.reduce((a, s) => a + data[s.key].length, 0) : 0;

  return (
    <div>
      <PageHead title="Reports & export" sub="Every record, current as of now — exported to a formatted Excel workbook.">
        <BtnPrimary icon="download" onClick={onDownload} disabled={busy || !data}>{busy ? 'Building…' : 'Download Excel'}</BtnPrimary>
      </PageHead>

      {!data ? <Spinner label="Gathering your data…" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            {SHEETS.map((s) => (
              <ACard key={s.key} pad={18} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AIcon name={s.icon} size={21} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em', lineHeight: 1 }}>{data[s.key].length}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 4 }}>{s.name}</div>
                </div>
              </ACard>
            ))}
          </div>

          <ACard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Workbook contents</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{SHEETS.length + 1} sheets · {total} rows · .xlsx</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--green)', background: 'var(--green-soft)', padding: '6px 11px', borderRadius: 8 }}>
                <AIcon name="download" size={14} color="var(--green)" /> {orgName.replace(/[^a-z0-9]+/gi, '_')}_HR_Export.xlsx
              </span>
            </div>
            {[{ key: 'summary' as const, name: 'Summary', desc: 'Org snapshot & metadata', icon: 'grid', n: '—' }, ...SHEETS.map((s) => ({ ...s, n: String(data[s.key].length) }))].map((s, i, arr) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 22px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AIcon name={s.icon} size={17} color="var(--accent)" /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)' }}>{s.name}</div><div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{s.desc}</div></div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', background: 'var(--soft)', padding: '5px 11px', borderRadius: 999 }}>{s.n} {s.n === '—' ? '' : 'rows'}</span>
              </div>
            ))}
          </ACard>
        </>
      )}
    </div>
  );
}

// ── Notification bell (live) ──────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try { setItems(await listNotifications()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => onTableChange('notifications', () => { void load(); }), [load]);

  const unread = items.filter((n) => !n.read).length;
  const fmtTime = (iso: string) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
  };
  const onItem = (n: Notification) => { if (!n.read) void markNotificationRead(n.id).then(load).catch(console.error); };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} title="Notifications" style={{ position: 'relative', width: 42, height: 42, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AIcon name="bell" size={20} color="var(--ink-2)" />
        {unread > 0 && <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--panel)' }}>{unread}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{ position: 'absolute', right: 0, top: 50, width: 360, maxHeight: 460, overflowY: 'auto', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 18px 50px rgba(16,28,48,0.22)', zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-1)' }}>Notifications</span>
              {unread > 0 && <button onClick={() => { void markAllNotificationsRead().then(load); }} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Mark all read</button>}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No notifications yet.</div>
            ) : items.map((n) => (
              <div key={n.id} onClick={() => onItem(n)} style={{ display: 'flex', gap: 11, padding: '12px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--accent-soft)' }}>
                <div style={{ width: 8, flexShrink: 0, paddingTop: 5 }}>{!n.read && <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-1)' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{fmtTime(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Billing (Razorpay · annual per-seat tiers) ────────────────────────
const payBtn: CSSProperties = { height: 42, padding: '0 22px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const seatInput: CSSProperties = { width: 110, height: 42, borderRadius: 11, border: '1px solid var(--line)', padding: '0 12px', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', background: '#fff', outline: 'none' };

function Billing({ billing, seatsUsed, canManage, onToast, onRefresh }: { billing: OrgBilling | null; seatsUsed: number; canManage: boolean; onToast: (t: string, tone?: string, icon?: string) => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState(0);
  const [reimbChecked, setReimbChecked] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [reqMgr, setReqMgr] = useState(true);

  useEffect(() => {
    if (billing) setSeats((s) => s || Math.max(seatsUsed, billing.seats ?? 0, 1));
  }, [billing, seatsUsed]);
  useEffect(() => {
    if (billing?.id) listPayments(billing.id).then(setPayments).catch(() => {});
  }, [billing?.id]);
  useEffect(() => {
    if (billing) setReqMgr(billing.reimbursement_require_manager);
  }, [billing?.reimbursement_require_manager]);

  if (!billing) return <Spinner label="Loading billing…" />;
  const paid = isPaid(billing);
  const plan = planFor(billing);
  const limit = seatLimit(billing);
  const limitText = limit === Infinity ? 'Unlimited' : String(limit);
  const daysLeft = periodDaysLeft(billing);
  const over = atSeatLimit(billing, seatsUsed);
  const minSeats = Math.max(seatsUsed, 1);
  const qty = Math.max(minSeats, Math.floor(seats) || 0);
  const reimbActive = reimbursementActive(billing);
  const reimbEntitled = reimbursementEntitled(billing);
  // Tick state: an entitled org (free tier, or already paid) toggles reimbursement
  // on/off instantly; a non-entitled paid org stages the add-on into the payment.
  const reimbWanted = reimbEntitled ? reimbActive : reimbChecked;
  const quote = quoteFor(billing, qty, reimbWanted);
  const seatPortion = quote.amount - quote.addonAmount;
  const periodEndText = billing.current_period_end ? new Date(billing.current_period_end).toLocaleDateString() : '—';
  const statusText = paid ? 'active' : billing.subscription_status === 'active' ? 'expired' : 'free';

  const checkout = async (chkSeats: number, reimbursement: boolean, ok: string) => {
    setBusy(true);
    try {
      await startCheckout(chkSeats, reimbursement);
      onToast(ok, 'green', 'checkCircle');
      onRefresh();
      listPayments(billing.id).then(setPayments).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      onToast(msg, msg.toLowerCase().includes('cancel') ? 'amber' : 'red', msg.toLowerCase().includes('cancel') ? 'wallet' : 'xCircle');
    } finally { setBusy(false); }
  };
  const pay = () => checkout(qty, reimbWanted, quote.renewal ? 'Payment received — renewed for 1 year' : 'Payment received — plan updated');

  const toggleReqMgr = async (val: boolean) => {
    setReqMgr(val);
    try { await updateOrganization(billing.id, { reimbursement_require_manager: val }); onRefresh(); }
    catch { setReqMgr(!val); onToast('Could not update setting', 'red', 'xCircle'); }
  };
  // Turn the reimbursement add-on on/off (entitled orgs only — no payment).
  const toggleReimbOn = async (on: boolean) => {
    try {
      await updateOrganization(billing.id, { reimbursement_disabled: !on });
      onToast(on ? 'Reimbursement turned on' : 'Reimbursement turned off — all its features are now hidden', on ? 'green' : 'amber', 'receipt');
      onRefresh();
    } catch { onToast('Could not update setting', 'red', 'xCircle'); }
  };

  return (
    <div>
      <PageHead title="Billing" sub="Your plan, seats and payments — up to 5 employees free, billed annually above that via Razorpay." />
      <ACard style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, var(--green)))', border: 'none', color: '#fff', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Current plan</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{statusText}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{plan.name}{paid ? ' · Annual' : ''}</div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
            {paid ? `₹${rateFor(billing.seats ?? seatsUsed)} / employee / month · billed annually`
              : `Free for up to ${FREE_SEAT_LIMIT} employees${daysLeft > 0 ? ` · renews free in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : ''}`}
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 20, flexWrap: 'wrap' }}>
            {([['Seats used', `${seatsUsed} / ${limitText}`], ['Status', statusText], [paid ? 'Renews' : 'Valid till', periodEndText]] as const).map((s) => (
              <div key={s[0]}><div style={{ fontSize: 12, opacity: 0.8 }}>{s[0]}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, textTransform: s[0] === 'Status' ? 'capitalize' : 'none' }}>{s[1]}</div></div>
            ))}
          </div>
        </div>
      </ACard>

      <ACard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Seat usage</div>
          {over && <APill tone="amber">Seat limit reached</APill>}
        </div>
        <div style={{ height: 10, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${limit === Infinity ? (seatsUsed ? 40 : 0) : Math.min(100, (seatsUsed / limit) * 100)}%`, height: '100%', background: over ? 'var(--amber)' : 'var(--accent)', borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{seatsUsed} of {limitText} seats in use{!paid ? ` · the free plan covers up to ${FREE_SEAT_LIMIT} employees` : ''}</div>
      </ACard>

      <ACard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 10 }}>Pricing — per employee / month, billed annually</div>
        {TIERS.map((t) => {
          const current = qty <= t.upTo && (TIERS[TIERS.indexOf(t) - 1]?.upTo ?? 0) < qty;
          return (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 9, background: current ? 'var(--soft)' : 'transparent', fontWeight: current ? 700 : 500, fontSize: 13.5, color: current ? 'var(--ink-1)' : 'var(--ink-2)' }}>
              <span>{t.label} employees</span>
              <span>{t.rate === 0 ? 'Free' : `₹${t.rate} / emp / mo`}</span>
            </div>
          );
        })}
      </ACard>

      {canManage && (
        <ACard style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 12 }}>{quote.renewal ? 'Renew — 1 year' : paid ? 'Change plan' : 'Buy seats / add-ons'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 5 }}>Employees / seats</div>
              <input type="number" min={minSeats} value={seats || qty} onChange={(e) => setSeats(Number(e.target.value))} style={seatInput} aria-label="Number of seats" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 14px', borderRadius: 11, border: `1px solid ${reimbWanted ? 'var(--accent)' : 'var(--line)'}`, background: reimbWanted ? 'var(--accent-soft)' : 'var(--panel)', cursor: canManage ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={reimbWanted} disabled={!canManage} onChange={(e) => { const v = e.target.checked; if (reimbEntitled) void toggleReimbOn(v); else setReimbChecked(v); }} style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: canManage ? 'pointer' : 'default' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>Reimbursement add-on {reimbEntitled ? (reimbActive ? '— on' : '— off') : `· ₹${REIMBURSEMENT_RATE}/emp/mo`}</span>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600 }}>
              {quote.amount > 0 ? (
                <>
                  {seatPortion > 0 && <>Seats <b style={{ color: 'var(--ink-1)' }}>{fmtINR(seatPortion)}</b></>}
                  {seatPortion > 0 && quote.addonAmount > 0 && <span style={{ color: 'var(--ink-3)' }}> + </span>}
                  {quote.addonAmount > 0 && <>Reimbursement <b style={{ color: 'var(--ink-1)' }}>{fmtINR(quote.addonAmount)}</b></>}
                  {' = '}<b style={{ color: 'var(--ink-1)', fontWeight: 800 }}>{fmtINR(quote.amount)}</b> {quote.prorated ? <span style={{ color: 'var(--ink-3)' }}>now (prorated to {quote.periodEnd.toLocaleDateString()})</span> : quote.renewal ? '/ year' : 'now'}
                </>
              ) : <span style={{ color: 'var(--ink-3)' }}>Nothing due — add seats (6+) or tick the add-on.</span>}
            </div>
            <button onClick={() => { void pay(); }} disabled={busy || quote.amount <= 0} style={{ ...payBtn, marginLeft: 'auto', opacity: busy || quote.amount <= 0 ? 0.7 : 1 }}>{busy ? 'Processing…' : `Pay ${fmtINR(quote.amount)}`}</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10 }}>
            {quote.renewal ? 'Starts a fresh 1-year period.' : `Prorated for the days left in your period; renews at ${fmtINR(quote.annualAtRenewal)}/year.`} Minimum {minSeats} seat{minSeats === 1 ? '' : 's'} (your roster). UPI, cards & netbanking accepted.
          </div>
        </ACard>
      )}

      <ACard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AIcon name="receipt" size={19} color="var(--accent)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Reimbursement add-on</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Expense claims with receipts, approvals & payouts · {paid ? `₹${REIMBURSEMENT_RATE} / employee / month` : `free on the ${FREE_SEAT_LIMIT}-employee plan`}</div>
          </div>
          {reimbActive
            ? <APill tone="green"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{paid ? 'Active' : 'Included'}</APill>
            : reimbEntitled ? <APill tone="neutral">Off</APill> : null}
        </div>
        {reimbActive ? (
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: canManage ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={reqMgr} disabled={!canManage} onChange={(e) => toggleReqMgr(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: canManage ? 'pointer' : 'default' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)' }}>Require manager approval before HR</span>
            </label>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, marginLeft: 27 }}>
              {reqMgr ? 'Claims route Employee → Manager → HR → paid (employees without a manager skip to HR).' : 'Claims route Employee → HR → paid (manager step skipped).'}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-3)' }}>
            {!canManage ? 'Ask an owner or HR admin to enable this add-on.'
              : reimbEntitled ? 'Turned off — all reimbursement features are hidden. Tick “Reimbursement add-on” in the box above to turn it back on (no charge).'
              : 'Tick “Reimbursement add-on” in the box above and pay to switch it on.'}
          </div>
        )}
      </ACard>

      {payments.length > 0 && (
        <ACard style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Payment history</div>
          {payments.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 4px', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>{new Date(p.created_at).toLocaleDateString()}</span>
              <span>{p.seats} seats</span>
              <span style={{ fontWeight: 700, color: 'var(--ink-1)' }}>{fmtINR(p.amount_inr)}</span>
              <span style={{ color: 'var(--ink-3)' }}>valid till {new Date(p.period_end).toLocaleDateString()}</span>
            </div>
          ))}
        </ACard>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: 'var(--ink-3)' }}>
        <AIcon name="shield" size={15} color="var(--ink-3)" />
        <span style={{ fontSize: 12 }}>Payments are processed securely by Razorpay. Connect your Razorpay keys (SETUP.md §6) to enable purchases.</span>
      </div>
    </div>
  );
}
