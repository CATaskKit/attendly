import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export type ExportData = {
  employees: Record<string, unknown>[];
  leave_requests: Record<string, unknown>[];
  leave_balances: Record<string, unknown>[];
  departments: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
};

export type SheetMeta = { key: keyof ExportData; name: string; desc: string; icon: string };
export const SHEETS: SheetMeta[] = [
  { key: 'employees', name: 'Employees', desc: 'Full employee directory', icon: 'users' },
  { key: 'leave_requests', name: 'Leave Requests', desc: 'All applications & stages', icon: 'inbox' },
  { key: 'leave_balances', name: 'Leave Balances', desc: 'Allotted, used & remaining', icon: 'umbrella' },
  { key: 'departments', name: 'Departments', desc: 'Org structure', icon: 'grid' },
  { key: 'attendance', name: 'Attendance', desc: 'Daily check-in / out log', icon: 'calendarClock' },
];

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// Pull every tenant table the report covers (RLS scopes each to the org).
export async function fetchExportData(): Promise<ExportData> {
  const s = db();
  const [emp, lv, bal, dep, att] = await Promise.all([
    s.from('employees').select('code,name,dept,designation,manager,type,status,email,phone,joined').order('name'),
    s.from('leave_requests').select('emp,code,dept,type,from_date,to_date,days,half,status,stage,reason,attachment,applied_at').order('applied_at', { ascending: false }),
    s.from('leave_balances').select('code,name,type,allotted,used,pending'),
    s.from('departments').select('name,created_at').order('name'),
    s.from('attendance').select('day,check_in_at,check_out_at,status,work_seconds,location').order('day', { ascending: false }),
  ]);
  for (const r of [emp, lv, bal, dep, att]) if (r.error) throw r.error;
  return {
    employees: emp.data ?? [], leave_requests: lv.data ?? [], leave_balances: bal.data ?? [],
    departments: dep.data ?? [], attendance: att.data ?? [],
  };
}

function autoWidths(rows: Record<string, unknown>[]): { wch: number }[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((k) => {
    const max = Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length));
    return { wch: Math.min(48, Math.max(10, max + 2)) };
  });
}

/**
 * Server-side export via the `export-report` Edge Function. Builds the workbook
 * on Supabase (paginated, RLS-scoped) and downloads the bytes — keeps large
 * exports off the browser. Throws if the function isn't deployed/reachable, so
 * callers can fall back to the client-side build.
 */
export async function downloadWorkbookServer(orgName: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${base}/functions/v1/export-report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: anon },
  });
  if (!res.ok) throw new Error(`Server export failed (${res.status})`);
  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = orgName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Attendly';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe}_HR_Export_${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Build & download a multi-sheet .xlsx from plain row arrays (client-side). */
export function downloadSheets(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]): void {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = sh.rows.length ? XLSX.utils.json_to_sheet(sh.rows) : XLSX.utils.aoa_to_sheet([['No records']]);
    if (sh.rows.length) ws['!cols'] = autoWidths(sh.rows);
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename, { compression: true });
}

export function downloadWorkbook(data: ExportData, orgName: string): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = [
    ['Attendly · HR Data Export', ''],
    ['Organization', orgName],
    ['Generated', new Date().toLocaleString()],
    ['', ''],
    ['Employees', data.employees.length],
    ['Leave requests', data.leave_requests.length],
    ['Pending requests', data.leave_requests.filter((r) => r.status === 'Pending').length],
    ['Departments', data.departments.length],
    ['Attendance records', data.attendance.length],
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(summary);
  ws0['!cols'] = [{ wch: 26 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

  for (const sheet of SHEETS) {
    const rows = data[sheet.key];
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['No records']]);
    if (rows.length) ws['!cols'] = autoWidths(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = orgName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Attendly';
  XLSX.writeFile(wb, `${safe}_HR_Export_${stamp}.xlsx`, { compression: true });
}
