import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AIcon, AAvatar, ACard, APill, ABadge, PageHead, BtnGhost, BtnPrimary, Spinner } from './ui';
import { supabase } from '../lib/supabase';
import type { Employee, LeaveRow } from '../lib/api';

// Restored from the original design handoff (admin-screens2.jsx). Both screens
// are computed from live data: real employees + this month's attendance rows +
// approved leave. Payroll basic-salary has no backend column yet, so it is
// editable inline and persisted locally per-org.

const td: CSSProperties = { padding: '13px 18px', borderBottom: '1px solid var(--line)', fontSize: 13.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' };
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--ink-1)' };

function TableShell({ head, children, foot }: { head: (string | { t: string; r?: boolean })[]; children: ReactNode; foot?: ReactNode }) {
  return (
    <ACard pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>{head.map((h, i) => {
            const r = typeof h === 'object' && h.r;
            return <th key={i} style={{ textAlign: r ? 'right' : 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '14px 18px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', background: 'var(--bg)' }}>{typeof h === 'string' ? h : h.t}</th>;
          })}</tr></thead>
          <tbody>{children}</tbody>
          {foot && <tfoot>{foot}</tfoot>}
        </table>
      </div>
    </ACard>
  );
}

function EmptyTable({ label }: { label: string }) {
  return (
    <ACard pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ink-3)' }}>
        <AIcon name="users" size={28} color="var(--ink-3)" />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginTop: 10 }}>{label}</div>
        <div style={{ fontSize: 12.5, marginTop: 3 }}>Add employees and record attendance to see this report.</div>
      </div>
    </ACard>
  );
}

const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Count Mon–Fri between two day-of-month numbers (inclusive) in the given month.
function countWeekdays(year: number, month: number, fromDay: number, toDay: number): number {
  let n = 0;
  for (let d = fromDay; d <= toDay; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

function useMonthAttendance(orgId: string | null) {
  const [rows, setRows] = useState<{ employee_id: string; day: string; work_seconds: number | null; check_in_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase || !orgId) { setLoading(false); return; }
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
    setLoading(true);
    supabase.from('attendance').select('employee_id,day,work_seconds,check_in_at').eq('org_id', orgId).gte('day', start).lte('day', end)
      .then(({ data, error }) => { if (error) console.error(error); else setRows((data as typeof rows) ?? []); setLoading(false); });
  }, [orgId]);
  return { rows, loading };
}

// Approved leave days per employee code, for the current month.
function leaveDaysByCode(leave: LeaveRow[]): Record<string, number> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const out: Record<string, number> = {};
  for (const l of leave) {
    if (l.status !== 'Approved' || !l.code) continue;
    if (l.from_date && !l.from_date.startsWith(monthKey) && l.to_date && !l.to_date.startsWith(monthKey)) continue;
    out[l.code] = (out[l.code] ?? 0) + Number(l.days || 0);
  }
  return out;
}

// ── ATTENDANCE MIS ───────────────────────────────────────────────────
export function AttendanceMIS({ orgId, employees, leave }: { orgId: string | null; employees: Employee[]; leave: LeaveRow[] }) {
  const { rows, loading } = useMonthAttendance(orgId);
  const active = employees.filter((e) => e.status === 'Active');

  const now = new Date();
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weekdaysElapsed = countWeekdays(now.getFullYear(), now.getMonth(), 1, Math.min(today, lastDay));
  const leaveByCode = useMemo(() => leaveDaysByCode(leave), [leave]);

  const data = active.map((e) => {
    const mine = rows.filter((r) => r.employee_id === e.id);
    const present = new Set(mine.map((r) => r.day)).size;
    const hrs = mine.reduce((a, r) => a + Number(r.work_seconds ?? 0), 0) / 3600;
    const late = mine.filter((r) => {
      if (!r.check_in_at) return false;
      const t = new Date(r.check_in_at);
      const mins = t.getHours() * 60 + t.getMinutes();
      return mins > 9 * 60 + 35; // after 09:35 (09:30 shift + grace)
    }).length;
    const lv = leaveByCode[e.code] ?? 0;
    const absent = Math.max(0, weekdaysElapsed - present - lv);
    return { e, present, leave: lv, absent, late, hrs };
  });
  const sum = (k: 'present' | 'leave' | 'absent' | 'late') => data.reduce((a, r) => a + r[k], 0);
  const fmtHrs = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

  return (
    <div>
      <PageHead title="Attendance MIS" sub={`${MONTH_LABEL} · monthly attendance report`}>
        <BtnGhost icon="download">Excel</BtnGhost>
      </PageHead>
      {loading ? <Spinner label="Computing attendance…" /> : active.length === 0 ? <EmptyTable label="No active employees" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
            {([['Present days', sum('present'), 'green'], ['Leave days', sum('leave'), 'accent'], ['Absent days', sum('absent'), 'red'], ['Late marks', sum('late'), 'amber']] as const).map(([l, v, t]) => (
              <ACard key={l} pad={16}><div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: `var(--${t})`, marginTop: 4, letterSpacing: '-0.02em' }}>{v}</div></ACard>
            ))}
          </div>
          <TableShell
            head={['Employee', 'Department', { t: 'Present', r: true }, { t: 'Leave', r: true }, { t: 'Absent', r: true }, { t: 'Late', r: true }, { t: 'Working hrs', r: true }]}
            foot={<tr><td style={{ ...td, fontWeight: 800, color: 'var(--ink-1)', borderBottom: 'none' }} colSpan={2}>Total · {data.length} employees</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('present')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('leave')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('absent')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('late')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td></tr>}>
            {data.map((r) => (
              <tr key={r.e.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={r.e.name} size={32} /><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{r.e.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{r.e.code}</div></div></div></td>
                <td style={td}>{r.e.dept || '—'}</td>
                <td style={tdNum}>{r.present}</td>
                <td style={tdNum}>{r.leave}</td>
                <td style={{ ...tdNum, color: r.absent ? 'var(--red)' : 'var(--ink-3)' }}>{r.absent}</td>
                <td style={tdNum}>{r.late}</td>
                <td style={tdNum}>{fmtHrs(r.hrs)}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </div>
  );
}

// ── PAYROLL MIS ──────────────────────────────────────────────────────
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function PayrollMIS({ orgId, employees, leave, canManage, onToast }: { orgId: string | null; employees: Employee[]; leave: LeaveRow[]; canManage: boolean; onToast: (t: string, tone?: string, icon?: string) => void }) {
  const { rows, loading } = useMonthAttendance(orgId);
  const active = employees.filter((e) => e.status === 'Active');
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalDays = countWeekdays(now.getFullYear(), now.getMonth(), 1, lastDay);
  // Working days elapsed so far — future weekdays aren't "absent" yet, so they
  // must not be deducted mid-month.
  const elapsed = countWeekdays(now.getFullYear(), now.getMonth(), 1, Math.min(now.getDate(), lastDay));
  const leaveByCode = useMemo(() => leaveDaysByCode(leave), [leave]);

  // Basic salary per employee code — no backend column, so persisted locally.
  const storeKey = `attendly:payroll:${orgId ?? 'demo'}:salary`;
  const [salary, setSalary] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { return {}; }
  });
  const setBasic = (code: string, v: number) => {
    const next = { ...salary, [code]: v };
    setSalary(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [processed, setProcessed] = useState(false);

  const data = active.map((e) => {
    const mine = rows.filter((r) => r.employee_id === e.id);
    const present = new Set(mine.map((r) => r.day)).size;
    const lv = leaveByCode[e.code] ?? 0;
    const basic = salary[e.code] ?? 70000;
    const perDay = totalDays > 0 ? basic / totalDays : 0;
    // Loss-of-pay = working days elapsed not covered by attendance or paid leave.
    const lop = Math.max(0, elapsed - present - lv);
    const paid = Math.max(0, totalDays - lop);
    const payable = Math.max(0, basic - perDay * lop);
    return { e, basic, paid, lop, leave: lv, payable };
  });
  const totalPayable = data.reduce((a, r) => a + r.payable, 0);
  const totalBasic = data.reduce((a, r) => a + r.basic, 0);
  const deductions = totalBasic - totalPayable;

  const doProcess = () => { setProcessed(true); onToast(`Salary processed · ${inr(totalPayable)} queued for ${data.length} employees`); };

  return (
    <div>
      <PageHead title="Payroll" sub={`${MONTH_LABEL} pay run · ${totalDays} working days`}>
        <BtnGhost icon="download">Excel</BtnGhost>
        {canManage && (processed ? <BtnGhost icon="checkCircle">Download payslips</BtnGhost> : <BtnPrimary icon="wallet" onClick={doProcess}>Process salary</BtnPrimary>)}
      </PageHead>
      {loading ? <Spinner label="Computing payroll…" /> : active.length === 0 ? <EmptyTable label="No active employees" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <ACard pad={20} style={{ background: processed ? 'var(--green-soft)' : 'var(--accent-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AIcon name="wallet" size={16} color={processed ? 'var(--green)' : 'var(--accent-deep)'} sw={1.9} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: processed ? 'var(--green)' : 'var(--accent-deep)' }}>{processed ? 'Amount processed' : 'Amount to process'}</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{inr(totalPayable)}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 7 }}>Net of {inr(deductions)} leave-without-pay deductions</div>
            </ACard>
            <ACard pad={20}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>Employees</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1 }}>{data.length}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8 }}>Gross {inr(totalBasic)}</div>
            </ACard>
            <ACard pad={20} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 }}>Run status</div>
                <div style={{ marginTop: 10 }}>{processed ? <ABadge status="Approved" /> : <APill tone="amber"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />Ready to process</APill>}</div>
              </div>
            </ACard>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: processed ? 'var(--green-soft)' : 'var(--soft)', border: '1px solid var(--line)' }}>
            <AIcon name={processed ? 'checkCircle' : 'shield'} size={18} color={processed ? 'var(--green)' : 'var(--ink-3)'} />
            <span style={{ fontSize: 13, color: processed ? 'var(--green)' : 'var(--ink-2)', fontWeight: 600 }}>
              {processed ? `Salary processed for ${data.length} employees. Payslips generated and disbursement queued.` : `Salary payable = Basic − (Basic ÷ ${totalDays} working days) × LOP days. Present days and approved leave are paid; only absences (${elapsed} working days elapsed) reduce pay. Edit basic salary inline, then process.`}
            </span>
          </div>

          <TableShell
            head={['Employee', { t: 'Basic salary', r: true }, { t: 'Working days', r: true }, { t: 'Paid days', r: true }, { t: 'LOP days', r: true }, { t: 'Salary payable', r: true }]}
            foot={<tr><td style={{ ...td, fontWeight: 800, color: 'var(--ink-1)', borderBottom: 'none' }}>Total payable · {data.length}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{inr(totalBasic)}</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none', fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{inr(totalPayable)}</td></tr>}>
            {data.map((r) => (
              <tr key={r.e.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={r.e.name} size={32} /><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{r.e.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.e.dept || '—'}</div></div></div></td>
                <td style={{ ...tdNum, padding: '8px 18px' }}>
                  <input type="number" value={r.basic} disabled={!canManage} onChange={(ev) => setBasic(r.e.code, Number(ev.target.value) || 0)}
                    style={{ width: 110, textAlign: 'right', height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={tdNum}>{totalDays}</td>
                <td style={tdNum}>{r.paid}</td>
                <td style={{ ...tdNum, color: r.lop ? 'var(--red)' : 'var(--ink-3)' }}>{r.lop}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--ink-1)' }}>{inr(r.payable)}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </div>
  );
}
