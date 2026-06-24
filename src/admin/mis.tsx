import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AIcon, AAvatar, ACard, APill, ABadge, PageHead, BtnGhost, BtnPrimary, Spinner } from './ui';
import { supabase } from '../lib/supabase';
import type { Employee, LeaveRow, Holiday } from '../lib/api';
import { setEmployeeBasicSalary, getOrganizationSettings, setOrganizationSetting, listPayrollAdjustments, savePayrollAdjustment } from '../lib/api';
import { countExtraDays } from '../lib/compoff';
import { countWorkingDays, type WeekendConfig } from '../lib/calendar';
import { payrollPolicyFrom, cycleRange, cycleBreakdown, isUnpaidLeave, leaveDaysInCycle, DEFAULT_PAYROLL, type PayrollPolicy } from '../lib/payroll';
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

// Pay-month picker options: next month first, then the previous 13 months.
function monthOptions(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const base = new Date();
  for (let i = -1; i <= 13; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
  }
  return out;
}

// Attendance days within an explicit cycle range (drives optional overtime pay).
function useCycleAttendance(orgId: string | null, startISO: string, endISO: string) {
  const [rows, setRows] = useState<{ employee_id: string; day: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase || !orgId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    supabase.from('attendance').select('employee_id,day').eq('org_id', orgId).gte('day', startISO).lte('day', endISO)
      .then(({ data, error }) => { if (error) console.error(error); setRows((data as { employee_id: string; day: string }[]) ?? []); setLoading(false); });
  }, [orgId, startISO, endISO]);
  return { rows, loading };
}

const ctrlWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const ctrlLabel: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const selectStyle: CSSProperties = { height: 38, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 12px', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none' };

export function PayrollMIS({ orgId, employees, leave, holidays, weekend, canManage, onToast }: { orgId: string | null; employees: Employee[]; leave: LeaveRow[]; holidays: Holiday[]; weekend: WeekendConfig; canManage: boolean; onToast: (t: string, tone?: string, icon?: string) => void }) {
  const active = employees.filter((e) => e.status === 'Active');
  const months = useMemo(monthOptions, []);
  const [sel, setSel] = useState(`${new Date().getFullYear()}-${new Date().getMonth()}`);
  const [selY, selM] = sel.split('-').map(Number);

  // Company payroll policy — cycle start day + per-day basis — persisted in org
  // settings so the company decides it once. Managers can change it inline.
  const [policy, setPolicy] = useState<PayrollPolicy>(DEFAULT_PAYROLL);
  useEffect(() => { if (orgId) getOrganizationSettings(orgId).then((s) => setPolicy(payrollPolicyFrom(s))).catch(() => {}); }, [orgId]);
  const savePolicy = (next: PayrollPolicy) => {
    setPolicy(next);
    if (orgId) setOrganizationSetting(orgId, 'payrollPolicy', next).catch((err) => { console.error(err); onToast('Could not save payroll setting', 'red', 'xCircle'); });
  };

  // Every holiday earns comp-off, but only COMPULSORY ones (National/Festival —
  // i.e. not 'Optional') close the office and reduce working days.
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const compulsoryHolidays = useMemo(() => new Set(holidays.filter((h) => (h.type || '').toLowerCase() !== 'optional').map((h) => h.date)), [holidays]);
  const cycle = useMemo(() => cycleRange(selY, selM, policy.cycleStartDay), [selY, selM, policy.cycleStartDay]);
  // Working days = calendar − company weekends − compulsory holidays (computed,
  // never a fixed number).
  const breakdown = useMemo(() => cycleBreakdown(cycle.start, cycle.end, weekend, compulsoryHolidays), [cycle, weekend, compulsoryHolidays]);
  const workingDays = breakdown.working;
  const divisor = policy.dayBasis === 'working' ? workingDays : cycle.calendarDays;
  const basisLabel = policy.dayBasis === 'working' ? 'working days' : 'calendar days';

  const { rows: attRows, loading } = useCycleAttendance(orgId, cycle.startISO, cycle.endISO);

  // Approved UNPAID leave days per employee code, within the selected cycle.
  const unpaidByCode = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of leave) {
      if (l.status !== 'Approved' || !l.code || !isUnpaidLeave(l.type)) continue;
      const d = leaveDaysInCycle(l.from_date, l.to_date, l.days, cycle);
      if (d > 0) out[l.code] = (out[l.code] ?? 0) + d;
    }
    return out;
  }, [leave, cycle]);

  // Inline basic-salary edits (persisted to employees.basic_salary).
  const [edits, setEdits] = useState<Record<string, number>>({});
  const setBasic = (id: string, v: number) => {
    setEdits((p) => ({ ...p, [id]: v }));
    setEmployeeBasicSalary(id, v).catch((err) => { console.error(err); onToast('Could not save salary', 'red', 'xCircle'); });
  };

  // HR manual leave adjustment per employee (+ adds unpaid days, − waives them),
  // persisted per cycle in payroll_adjustments so the run survives a reload.
  const cycleKey = `${selY}-${selM}:${policy.cycleStartDay}`;
  const [adj, setAdj] = useState<Record<string, number>>({});
  const [payExtra, setPayExtra] = useState(false);
  const [processed, setProcessed] = useState(false);
  useEffect(() => {
    setPayExtra(false); setProcessed(false);
    if (!orgId) { setAdj({}); return; }
    let active = true;
    listPayrollAdjustments(orgId, cycleKey).then((m) => { if (active) setAdj(m); }).catch(() => { if (active) setAdj({}); });
    return () => { active = false; };
  }, [orgId, cycleKey]);
  const setAdjFor = (id: string, v: number) => {
    setAdj((p) => ({ ...p, [id]: v }));
    if (orgId) savePayrollAdjustment(orgId, id, cycleKey, v).catch((err) => { console.error(err); onToast('Could not save adjustment', 'red', 'xCircle'); });
  };

  const data = active.map((e) => {
    const basic = edits[e.id] ?? (Number(e.basic_salary) || 0);
    const unpaid = unpaidByCode[e.code] ?? 0;
    const adjust = adj[e.id] ?? 0;
    const lop = Math.max(0, unpaid + adjust);          // never negative pay-loss
    const perDay = divisor > 0 ? basic / divisor : 0;  // guard divide-by-zero
    const deduction = Math.min(basic, perDay * lop);   // never deduct more than the salary
    const extra = countExtraDays(attRows.filter((r) => r.employee_id === e.id).map((r) => r.day), holidaySet, weekend);
    const overtime = payExtra ? perDay * extra : 0;
    const payable = Math.max(0, basic - deduction) + overtime;
    return { e, basic, unpaid, adjust, lop, perDay, deduction, extra, overtime, payable };
  });
  const totalPayable = data.reduce((a, r) => a + r.payable, 0);
  const totalBasic = data.reduce((a, r) => a + r.basic, 0);
  const deductions = data.reduce((a, r) => a + r.deduction, 0);
  const totalOvertime = data.reduce((a, r) => a + r.overtime, 0);
  const totalExtra = data.reduce((a, r) => a + r.extra, 0);
  const totalLop = data.reduce((a, r) => a + r.lop, 0);
  const missingSalary = data.filter((r) => r.basic <= 0).length;

  const doProcess = () => {
    if (data.every((r) => r.basic <= 0)) { onToast('Set basic salary before processing', 'amber', 'wallet'); return; }
    setProcessed(true);
    onToast(`Salary processed · ${inr(totalPayable)} for ${data.length} employees`);
  };
  const exportXlsx = async () => {
    const rowsX = data.map((r) => ({
      Employee: r.e.name, Code: r.e.code, Department: r.e.dept || '',
      'Basic salary': Math.round(r.basic), 'Cycle': cycle.label, 'Cycle days': divisor, 'Day basis': basisLabel,
      'Unpaid leave': r.unpaid, 'HR adjustment': r.adjust, 'LOP days': r.lop,
      'Per-day rate': Math.round(r.perDay), 'Deduction': Math.round(r.deduction),
      'Extra days': r.extra, 'Overtime': Math.round(r.overtime), 'Salary payable': Math.round(r.payable),
    }));
    try { await downloadSheets(`Payroll_${cycle.label.replace(/[^a-z0-9]+/gi, '_')}.xlsx`, [{ name: 'Payroll', rows: rowsX }]); }
    catch (e) { console.error(e); onToast('Export failed', 'red', 'xCircle'); }
  };

  return (
    <div>
      <PageHead title="Payroll" sub={`${cycle.label} · ${divisor} ${basisLabel}`}>
        <BtnGhost icon="download" onClick={exportXlsx} disabled={loading || active.length === 0}>Excel</BtnGhost>
        {canManage && (processed ? <BtnGhost icon="checkCircle">Download payslips</BtnGhost> : <BtnPrimary icon="wallet" onClick={doProcess}>Process salary</BtnPrimary>)}
      </PageHead>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16, alignItems: 'flex-end' }}>
        <label style={ctrlWrap}>
          <span style={ctrlLabel}>Pay month</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ ...selectStyle, minWidth: 150 }}>
            {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label style={ctrlWrap}>
          <span style={ctrlLabel}>Cycle starts on day</span>
          <input type="number" min={1} max={28} value={policy.cycleStartDay} disabled={!canManage}
            onChange={(e) => savePolicy({ ...policy, cycleStartDay: Math.min(28, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
            title="1 = calendar month · e.g. 26 = 26th to 25th next month"
            style={{ ...selectStyle, width: 92, textAlign: 'right' }} />
        </label>
        <div style={ctrlWrap}>
          <span style={ctrlLabel}>Per-day rate basis</span>
          <div style={{ display: 'inline-flex', background: 'var(--soft)', borderRadius: 9, padding: 3, border: '1px solid var(--line)' }}>
            {(['calendar', 'working'] as const).map((b) => (
              <button key={b} disabled={!canManage} onClick={() => savePolicy({ ...policy, dayBasis: b })}
                style={{ border: 'none', cursor: canManage ? 'pointer' : 'default', padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                  background: policy.dayBasis === b ? 'var(--panel)' : 'transparent', color: policy.dayBasis === b ? 'var(--ink-1)' : 'var(--ink-3)', boxShadow: policy.dayBasis === b ? 'var(--card-shadow)' : 'none' }}>
                {b === 'calendar' ? `Calendar (${cycle.calendarDays})` : `Working (${workingDays})`}
              </button>
            ))}
          </div>
        </div>
      </div>

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
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8 }}>Gross {inr(totalBasic)} · {totalLop} LOP day{totalLop === 1 ? '' : 's'}</div>
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
              {processed ? `Salary processed for ${data.length} employees for ${cycle.label}.` : `Salary payable = Basic − (Basic ÷ ${divisor} ${basisLabel}) × LOP days. Working days = ${cycle.calendarDays} calendar − ${breakdown.weekends} weekend${breakdown.weekends === 1 ? '' : 's'} − ${breakdown.holidays} holiday${breakdown.holidays === 1 ? '' : 's'} = ${workingDays}. Only unpaid leave (+ HR adjustment) is deducted — paid leave and attendance gaps don't reduce pay.`}
            </span>
          </div>

          {missingSalary > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '11px 16px', borderRadius: 12, background: 'var(--amber-soft)', border: '1px solid var(--line)' }}>
              <AIcon name="wallet" size={17} color="var(--amber)" />
              <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{missingSalary} employee{missingSalary === 1 ? '' : 's'} {missingSalary === 1 ? 'has' : 'have'} no basic salary set — shown as ₹0 until you add it.</span>
            </div>
          )}

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
            head={['Employee', { t: 'Basic salary', r: true }, { t: 'Unpaid lv', r: true }, { t: 'HR adj ±', r: true }, { t: 'LOP days', r: true }, { t: 'Deduction', r: true }, { t: 'Salary payable', r: true }]}
            foot={<tr><td style={{ ...td, fontWeight: 800, color: 'var(--ink-1)', borderBottom: 'none' }}>Total · {data.length}</td><td style={{ ...tdNum, borderBottom: 'none' }}>{inr(totalBasic)}</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>—</td><td style={{ ...tdNum, borderBottom: 'none' }}>{totalLop}</td><td style={{ ...tdNum, borderBottom: 'none', color: 'var(--red)' }}>{inr(deductions)}</td><td style={{ ...tdNum, borderBottom: 'none', fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{inr(totalPayable)}</td></tr>}>
            {data.map((r) => (
              <tr key={r.e.id}>
                <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><AAvatar name={r.e.name} size={32} /><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{r.e.name}</div><div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.e.dept || '—'}</div></div></div></td>
                <td style={{ ...tdNum, padding: '8px 18px' }}>
                  <input type="number" min={0} value={r.basic} disabled={!canManage} onChange={(ev) => setBasic(r.e.id, Math.max(0, Number(ev.target.value) || 0))}
                    style={{ width: 110, textAlign: 'right', height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={{ ...tdNum, color: r.unpaid ? 'var(--red)' : 'var(--ink-3)' }}>{r.unpaid || '—'}</td>
                <td style={{ ...tdNum, padding: '8px 18px' }}>
                  <input type="number" value={r.adjust} disabled={!canManage} onChange={(ev) => setAdjFor(r.e.id, Number(ev.target.value) || 0)}
                    title="Add (+) or waive (−) unpaid leave days — saved per cycle"
                    style={{ width: 76, textAlign: 'right', height: 34, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', padding: '0 10px', fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'inherit', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                </td>
                <td style={{ ...tdNum, color: r.lop ? 'var(--red)' : 'var(--ink-3)' }}>{r.lop || '—'}</td>
                <td style={{ ...tdNum, color: r.deduction ? 'var(--red)' : 'var(--ink-3)' }}>{r.deduction ? `−${inr(r.deduction)}` : '—'}{r.overtime > 0 ? ` · +${inr(r.overtime)} OT` : ''}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--ink-1)' }}>{inr(r.payable)}</td>
              </tr>
            ))}
          </TableShell>
        </>
      )}
    </div>
  );
}
