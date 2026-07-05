import * as XLSX from 'xlsx-js-style';
import { supabase } from './supabase';
import { saveFile, MIME } from './native';

// ── Excel styling ────────────────────────────────────────────────────
// xlsx-js-style honours a `.s` style object on each cell. We give every
// exported table a branded header row (eHajri blue), zebra-striped body,
// thin borders and an auto-filter so the files look finished, not raw dumps.
const THIN = { style: 'thin', color: { rgb: 'D9DEE7' } };
const BORDERS = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const HEADER_STYLE = {
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDERS,
};
const bodyStyle = (even: boolean) => ({
  font: { sz: 10, color: { rgb: '1F2937' } },
  fill: { patternType: 'solid', fgColor: { rgb: even ? 'F4F7FB' : 'FFFFFF' } },
  alignment: { vertical: 'center' },
  border: BORDERS,
});

// Apply the header + body styling, auto-filter and a taller header row to a
// worksheet whose first row is the header. Mutates and returns the sheet.
function styleTable(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  if (!ws['!ref']) return ws;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = (ws[addr] ?? (ws[addr] = { t: 's', v: '' })) as XLSX.CellObject;
      cell.s = R === range.s.r ? HEADER_STYLE : bodyStyle((R - range.s.r) % 2 === 0);
    }
  }
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: range.s, e: { r: range.s.r, c: range.e.c } }) };
  const rows: XLSX.RowInfo[] = [{ hpt: 22 }];
  ws['!rows'] = rows;
  return ws;
}

// Build a styled worksheet from row objects (json). Empty → a plain note.
function styledSheet(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  if (!rows.length) return XLSX.utils.aoa_to_sheet([['No records']]);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = autoWidths(rows);
  return styleTable(ws);
}

export { styledSheet };

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
    s.from('attendance').select('day,check_in_at,check_out_at,status,work_seconds,location,checkout_location').order('day', { ascending: false }),
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
export async function downloadWorkbookServer(orgName: string): Promise<string | void> {
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
  const safe = orgName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'eHajri';
  return saveFile(`${safe}_HR_Export_${stamp}.xlsx`, blob, MIME.xlsx);
}

/** Build & save a multi-sheet .xlsx from plain row arrays (client-side). */
export async function downloadSheets(filename: string, sheets: { name: string; rows: Record<string, unknown>[] }[]): Promise<string | void> {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    XLSX.utils.book_append_sheet(wb, styledSheet(sh.rows), sh.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  return saveFile(filename, buf, MIME.xlsx);
}

export async function downloadWorkbook(data: ExportData, orgName: string): Promise<string | void> {
  const wb = XLSX.utils.book_new();

  // Summary sheet — branded title banner + label/value rows.
  const summary = [
    ['eHajri · HR Data Export', ''],
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
  ws0['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  ws0['!rows'] = [{ hpt: 26 }];
  const titleCell = ws0['A1'] as XLSX.CellObject;
  titleCell.s = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } }, alignment: { horizontal: 'left', vertical: 'center' } };
  for (let R = 1; R <= 8; R++) {
    const label = ws0[`A${R + 1}`] as XLSX.CellObject | undefined;
    if (label) label.s = { font: { bold: true, sz: 10, color: { rgb: '475569' } }, alignment: { vertical: 'center' } };
    const value = ws0[`B${R + 1}`] as XLSX.CellObject | undefined;
    if (value) value.s = { font: { sz: 10, color: { rgb: '1F2937' } }, alignment: { vertical: 'center' } };
  }
  XLSX.utils.book_append_sheet(wb, ws0, 'Summary');

  for (const sheet of SHEETS) {
    XLSX.utils.book_append_sheet(wb, styledSheet(data[sheet.key]), sheet.name.slice(0, 31));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const safe = orgName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'eHajri';
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  return saveFile(`${safe}_HR_Export_${stamp}.xlsx`, buf, MIME.xlsx);
}
