import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AIcon, AAvatar, ACard, APill, ABadge, PageHead, BtnGhost, BtnPrimary, Spinner } from './ui';
import { supabase } from '../lib/supabase';
import type { Employee, LeaveRow, Holiday } from '../lib/api';
import { setEmployeeBasicSalary } from '../lib/api';
import { countExtraDays } from '../lib/compoff';
import { countWorkingDays, type WeekendConfig } from '../lib/calendar';
import { downloadSheets } from '../lib/export';
import { lateThresholdMinutes, type ShiftPolicy } from '../lib/shift';
import CheckinMapModal from './CheckinMapModal';

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
export function AttendanceMIS({ orgId, employees, leave, holidays, weekend, shift }: { orgId: string | null; employees: Employee[]; leave: LeaveRow[]; holidays: Holiday[]; weekend: WeekendConfig; shift: ShiftPolicy }) {
  const { rows, loading } = useMonthAttendance(orgId);
  const active = employees.filter((e) => e.status === 'Active');

  const now = new Date();
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weekdaysElapsed = countWorkingDays(now.getFullYear(), now.getMonth(), 1, Math.min(today, lastDay), weekend);
  const leaveByCode = useMemo(() => leaveDaysByCode(leave), [leave]);
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const lateAfter = lateThresholdMinutes(shift); // minutes-since-midnight: shift start + grace

  const data = active.map((e) => {
    const mine = rows.filter((r) => r.employee_id === e.id);
    const present = new Set(mine.map((r) => r.day)).size;
    const hrs = mine.reduce((a, r) => a + Number(r.work_seconds ?? 0), 0) / 3600;
    const late = mine.filter((r) => {
      if (!r.check_in_at) return false;
      const t = new Date(r.check_in_at);
      const mins = t.getHours() * 60 + t.getMinutes();
      return mins > lateAfter; // after the org's shift start + grace
    }).length;
    const lv = leaveByCode[e.code] ?? 0;
    const extra = countExtraDays(mine.map((r) => r.day), holidaySet, weekend); // weekend/holiday work → comp-off
    // Extra (weekend/holiday) days don't offset weekday absence.
    const absent = Math.max(0, weekdaysElapsed - Math.max(0, present - extra) - lv);
    return { e, present, leave: lv, absent, late, extra, hrs };
  });
  const sum = (k: 'present' | 'leave' | 'absent' | 'late' | 'extra') => data.reduce((a, r) => a + r[k], 0);
  const fmtHrs = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;
  const [exporting, setExporting] = useState(false);
  const [mapEmp, setMapEmp] = useState<Employee | null>(null);

  // Full attendance report: a per-employee summary + a complete day-by-day log.
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const summaryRows = data.map((r) => ({
        Employee: r.e.name, Code: r.e.code, Department: r.e.dept || '',
        'Present days': r.present, 'Leave days': r.leave, 'Absent days': r.absent,
        'Late marks': r.late, 'Extra days': r.extra, 'Working hours': Number(r.hrs.toFixed(2)),
      }));
      let detailRows: Record<string, unknown>[] = [];
      if (supabase && orgId) {
        const y = now.getFullYear(), m = now.getMonth();
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const empById = new Map(employees.map((e) => [e.id, e]));
        const { data: det } = await supabase.from('attendance')
          .select('employee_id,day,check_in_at,check_out_at,status,work_seconds,location')
          .eq('org_id', orgId).gte('day', start).lte('day', end).order('day', { ascending: true });
        detailRows = (det ?? []).map((r) => {
          const e = empById.get(r.employee_id as string);
          const ci = r.check_in_at ? new Date(r.check_in_at as string) : null;
          const co = r.check_out_at ? new Date(r.check_out_at as string) : null;
          const mins = ci ? ci.getHours() * 60 + ci.getMinutes() : null;
          return {
            Date: r.day, Employee: e?.name || '—', Code: e?.code || '', Department: e?.dept || '',
            'Check in': ci ? ci.toLocaleTimeString() : '', 'Check out': co ? co.toLocaleTimeString() : '',
            Hours: r.work_seconds ? Number((Number(r.work_seconds) / 3600).toFixed(2)) : 0,
            Status: (r.status as string) || '', Late: mins != null && mins > lateAfter ? 'Yes' : '', Location: (r.location as string) || '',
          };
        });
      }
      await downloadSheets(`Attendance_${MONTH_LABEL.replace(/[^a-z0-9]+/gi, '_')}.xlsx`, [
        { name: 'Summary', rows: summaryRows },
        { name: 'Daily Log', rows: detailRows },
      ]);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  return (
    <div>
      <PageHead title="Attendance MIS" sub={`${MONTH_LABEL} · monthly attendance report`}>
        <BtnGhost icon="download" onClick={() => void exportXlsx()} disabled={exporting || loading || active.length === 0}>{exporting ? 'Exporting…' : 'Excel'}</BtnGhost>
      </PageHead>
      {loading ? <Spinner label="Computing attendance…" /> : active.length === 0 ? <EmptyTable label="No active employees" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
            {([['Present days', sum('present'), 'green'], ['Leave days', sum('leave'), 'accent'], ['Absent days', sum('absent'), 'red'], ['Late marks', sum('late'), 'amber']] as const).map(([l, v, t]) => (
              <ACard key={l} pad={16}><div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: `var(--${t})`, marginTop: 4, letterSpacing: '-0.02em' }}>{v}</div></ACard>
            ))}
          </div>
          <TableShell
            head={['Employee', 'Department', { t: 'Present', r: true }, { t: 'Leave', r: true }, { t: 'Absent', r: true }, { t: 'Late', r: true }, { t: 'Extra', r: true }, { t: 'Working hrs', r: true }]}
            foot={<tr><td style={{ ...td, fontWeight: 800, color: 'var(--ink-1)', borderBottom: 'none' }} colSpan={2}>Total · {data.length} employees</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('present')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('leave')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('absent')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('late')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{sum('extra')}</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td></tr>}>
            {data.map((r) => (
              <tr key={r.e.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={r.e.name} size={32} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{r.e.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{r.e.code}</div></div><button onClick={() => setMapEmp(r.e)} title="View check-in locations on map" style={{ border: 'none', background: 'var(--soft)', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><AIcon name="map" size={15} color="var(--accent)" /></button></div></td>
                <td style={td}>{r.e.dept || '—'}</td>
                <td style={tdNum}>{r.present}</td>
                <td style={tdNum}>{r.leave}</td>
                <td style={{ ...tdNum, color: r.absent ? 'var(--red)' : 'var(--ink-3)' }}>{r.absent}</td>
                <td style={tdNum}>{r.late}</td>
                <td style={{ ...tdNum, color: r.extra ? 'var(--green)' : 'var(--ink-3)' }}>{r.extra}</td>
                <td style={tdNum}>{fmtHrs(r.hrs)}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
      {mapEmp && <CheckinMapModal employee={mapEmp} orgId={orgId} onClose={() => setMapEmp(null)} />}
    </div>
  );
}

// ── PAYROLL MIS ──────────────────────────────────────────────────────
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function PayrollMIS({ orgId, employees, leave, holidays, weekend, canManage, onToast }: { orgId: string | null; employees: Employee[]; leave: LeaveRow[]; holidays: Holiday[]; weekend: WeekendConfig; canManage: boolean; onToast: (t: string, tone?: string, icon?: string) => void }) {
  const { rows, loading } = useMonthAttendance(orgId);
  const active = employees.filter((e) => e.status === 'Active');
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalDays = countWorkingDays(now.getFullYear(), now.getMonth(), 1, lastDay, weekend);
  // Working days elapsed so far — future working days aren't "absent" yet, so
  // they must not be deducted mid-month.
  const elapsed = countWorkingDays(now.getFullYear(), now.getMonth(), 1, Math.min(now.getDate(), lastDay), weekend);
  const leaveByCode = useMemo(() => leaveDaysByCode(leave), [leave]);
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const [payExtra, setPayExtra] = useState(false); // pay extra (weekend/holiday) days as overtime

  // Basic salary lives on employees.basic_salary (shared & persisted). A local
  // override keeps the input snappy until the parent re-fetches employees.
  const [edits, setEdits] = useState<Record<string, number>>({});
  const setBasic = (id: string, v: number) => {
    setEdits((p) => ({ ...p, [id]: v }));
    setEmployeeBasicSalary(id, v).catch((err) => { console.error(err); onToast('Could not save salary', 'red', 'xCircle'); });
  };
  const [processed, setProcessed] = useState(false);

  const data = active.map((e) => {
    const mine = rows.filter((r) => r.employee_id === e.id);
    const present = new Set(mine.map((r) => r.day)).size;
    const lv = leaveByCode[e.code] ?? 0;
    const basic = edits[e.id] ?? (Number(e.basic_salary) || 0);
    const perDay = totalDays > 0 ? basic / totalDays : 0;
    const extra = countExtraDays(mine.map((r) => r.day), holidaySet, weekend); // weekend/holiday work → comp-off, not regular attendance
    // Loss-of-pay = working days elapsed not covered by WEEKDAY attendance or paid leave.
    const lop = Math.max(0, elapsed - Math.max(0, present - extra) - lv);
    const paid = Math.max(0, totalDays - lop);
    const deduction = perDay * lop;
    const overtime = payExtra ? perDay * extra : 0;
    const payable = Math.max(0, basic - deduction) + overtime;
    return { e, basic, paid, lop, extra, overtime, deduction, leave: lv, payable };
  });
  const totalPayable = data.reduce((a, r) => a + r.payable, 0);
  const totalBasic = data.reduce((a, r) => a + r.basic, 0);
  const deductions = data.reduce((a, r) => a + r.deduction, 0);
  const totalOvertime = data.reduce((a, r) => a + r.overtime, 0);
  const totalExtra = data.reduce((a, r) => a + r.extra, 0);

  const doProcess = () => { setProcessed(true); onToast(`Salary processed · ${inr(totalPayable)} queued for ${data.length} employees`); };
  const exportXlsx = async () => {
    const rows = data.map((r) => ({
      Employee: r.e.name, Code: r.e.code, Department: r.e.dept || '',
      'Basic salary': Math.round(r.basic), 'Working days': totalDays, 'Paid days': r.paid,
      'LOP days': r.lop, 'Extra days': r.extra, 'LOP deduction': Math.round(r.deduction),
      Overtime: Math.round(r.overtime), 'Salary payable': Math.round(r.payable),
    }));
    try { await downloadSheets(`Payroll_${MONTH_LABEL.replace(/[^a-z0-9]+/gi, '_')}.xlsx`, [{ name: 'Payroll', rows }]); }
    catch (e) { console.error(e); onToast('Export failed', 'red', 'xCircle'); }
  };

  return (
    <div>
      <PageHead title="Payroll" sub={`${MONTH_LABEL} pay run · ${totalDays} working days`}>
        <BtnGhost icon="download" onClick={exportXlsx} disabled={loading || active.length === 0}>Excel</BtnGhost>
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
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 7 }}>Net of {inr(deductions)} LOP{totalOvertime > 0 ? ` · incl. ${inr(totalOvertime)} overtime` : ''}</div>
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

          {(totalExtra > 0 || payExtra) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '11px 16px', borderRadius: 12, background: payExtra ? 'var(--green-soft)' : 'var(--soft)', border: '1px solid var(--line)', cursor: canManage ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={payExtra} disabled={!canManage} onChange={(e) => setPayExtra(e.target.checked)} style={{ width: 17, height: 17, accentColor: 'var(--green)' }} />
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
                Pay {totalExtra} extra day{totalExtra === 1 ? '' : 's'} (weekend/holiday work) as overtime
                {payExtra ? ` · +${inr(totalOvertime)} added` : ' · otherwise they bank as comp-off for the employee'}
              </span>
            </label>
          )}

          <TableShell
            head={['Employee', { t: 'Basic salary', r: true }, { t: 'Working days', r: true }, { t: 'Paid days', r: true }, { t: 'LOP days', r: true }, { t: 'Extra days', r: true }, { t: 'Salary payable', r: true }]}
            foot={<tr><td style={{ ...td, fontWeight: 800, color: 'var(--ink-1)', borderBottom: 'none' }}>Total payable · {data.length}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{inr(totalBasic)}</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>{totalExtra}</td><td style={{ ...tdNum, borderBottom: 'none', fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{inr(totalPayable)}</td></tr>}>
            {data.map((r) => (
              <tr key={r.e.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={r.e.name} size={32} /><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{r.e.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.e.dept || '—'}</div></div></div></td>
                <td style={{ ...tdNum, padding: '8px 18px' }}>
                  <input type="number" value={r.basic} disabled={!canManage} onChange={(ev) => setBasic(r.e.id, Number(ev.target.value) || 0)}
                    style={{ width: 110, textAlign: 'right', height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={tdNum}>{totalDays}</td>
                <td style={tdNum}>{r.paid}</td>
                <td style={{ ...tdNum, color: r.lop ? 'var(--red)' : 'var(--ink-3)' }}>{r.lop}</td>
                <td style={{ ...tdNum, color: r.extra ? 'var(--green)' : 'var(--ink-3)' }}>{r.extra}{r.overtime > 0 ? ` · ${inr(r.overtime)}` : ''}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--ink-1)' }}>{inr(r.payable)}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </div>
  );
}
