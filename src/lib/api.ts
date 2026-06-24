import { supabase } from './supabase';
import { formatAppDate } from './networkTime';
import { COMP_OFF_TYPE, countExtraDays } from './compoff';
import { DEFAULT_WEEKEND, type WeekendConfig } from './calendar';

export type Employee = {
  id: string; code: string; name: string; dept: string | null; designation: string | null;
  manager: string | null; type: string | null; status: string; email: string | null;
  phone: string | null; joined: string | null; profile_id?: string | null; basic_salary?: number | null;
};

export type LeaveRow = {
  id: string; org_id: string; employee_id: string | null; emp: string | null; code: string | null; dept: string | null; type: string;
  from_date: string | null; to_date: string | null; days: number; half: boolean;
  reason: string | null; attachment: string | null; status: string; stage: string; applied_at: string;
};

export type Dept = { id: string; name: string };
export type Holiday = { id: string; name: string; date: string; type: string; description: string | null };
export type LeaveType = { id: string; name: string; quota: number; color: string | null };
export type LeaveBalance = { type: string; allotted: number; used: number; pending: number; available: number; color?: string | null };
export type AttendanceRow = {
  id: string; org_id: string; employee_id: string | null; day: string; check_in_at: string | null;
  check_out_at: string | null; status: string; work_seconds: number | null; location: string | null;
  selfie_url: string | null; ip: string | null; device: string | null; created_at: string;
  lat: number | null; lng: number | null;
  checkout_location: string | null; checkout_lat: number | null; checkout_lng: number | null;
};

export type Stats = {
  employees: number; active: number; departments: number; pendingLeave: number; presentToday: number;
};

export type ProfileLookup = {
  id: string;
  org_id: string | null;
  full_name?: string | null;
  email: string | null;
  employee_id?: string | null;
};

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const isoDate = (d: Date) => formatAppDate(d);
const num = (value: unknown) => Number(value ?? 0);
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
type AttendanceDetails = Partial<Pick<AttendanceRow, 'location' | 'selfie_url' | 'ip' | 'device' | 'lat' | 'lng'>> & {
  checkedAt?: string;
};

function isMissingRpcError(error: unknown) {
  const e = error as { code?: string; message?: string; details?: string };
  const text = `${e?.message ?? ''} ${e?.details ?? ''}`;
  return e?.code === 'PGRST202' || /function .* does not exist|could not find the function/i.test(text);
}

function mapBalance(row: Record<string, unknown>): LeaveBalance {
  const allotted = num(row.allotted);
  const used = num(row.used);
  const pending = num(row.pending);
  return {
    type: String(row.type),
    allotted,
    used,
    pending,
    available: Math.max(0, allotted - used - pending),
    color: (row.color as string | null | undefined) ?? null,
  };
}

async function nextEmployeeCode(orgId: string): Promise<string> {
  const { count, error } = await db()
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if (error) throw error;
  return `EMP-${String((count ?? 0) + 1).padStart(3, '0')}`;
}
// ── Employees ─────────────────────────────────────────────────────────
export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await db().from('employees').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function addEmployee(orgId: string, e: Partial<Employee>): Promise<void> {
  const { error } = await db().from('employees').insert({ org_id: orgId, ...e });
  if (error) throw error;
}

export async function updateEmployee(id: string, fields: Partial<Employee>): Promise<void> {
  // Only persist editable columns (never id / org_id / profile_id / created_at).
  const { code, name, dept, designation, manager, type, status, email, phone } = fields;
  const patch = { code, name, dept, designation, manager, type, status, email, phone };
  const { error } = await db().from('employees').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await db().from('employees').delete().eq('id', id);
  if (error) throw error;
}

export async function getMyEmployee(profile: ProfileLookup): Promise<Employee | null> {
  if (!profile.org_id) return null;
  const orgId = profile.org_id;

  const findOne = async (column: string, value: string) => {
    const { data, error } = await db()
      .from('employees')
      .select('*')
      .eq('org_id', orgId)
      .eq(column, value)
      .limit(1);
    if (error) throw error;
    return ((data ?? [])[0] as Employee | undefined) ?? null;
  };

  if (profile.employee_id) {
    const byEmployeeId = await findOne('id', profile.employee_id);
    if (byEmployeeId) return byEmployeeId;
  }

  const byProfileId = await findOne('profile_id', profile.id);
  if (byProfileId) return byProfileId;

  if (profile.email) return findOne('email', profile.email);
  return null;
}

export async function ensureMyEmployee(profile: ProfileLookup): Promise<Employee | null> {
  if (!profile.org_id) return null;
  const existing = await getMyEmployee(profile);
  if (existing) return existing;

  const row = {
    org_id: profile.org_id,
    code: await nextEmployeeCode(profile.org_id),
    name: profile.full_name || profile.email || 'Employee',
    email: profile.email,
    profile_id: profile.id,
    type: 'Full-time',
    status: 'Active',
    joined: isoDate(new Date()),
  };
  const { data, error } = await db().from('employees').insert(row).select('*').single();
  if (error) throw error;
  const employee = data as Employee;
  await db().from('profiles').update({ employee_id: employee.id }).eq('id', profile.id);
  return employee;
}

// ── Departments ───────────────────────────────────────────────────────
export async function listDepartments(): Promise<Dept[]> {
  const { data, error } = await db().from('departments').select('id,name').order('name');
  if (error) throw error;
  return (data ?? []) as Dept[];
}

export async function listLeaveTypes(): Promise<LeaveType[]> {
  const { data, error } = await db().from('leave_types').select('id,name,quota,color').order('name');
  if (error) throw error;
  return (data ?? []) as LeaveType[];
}

// ── Organization + onboarding writes ──────────────────────────────────
export type OrgRow = { id: string; name: string; display_name: string | null; industry: string | null; country: string | null; timezone: string | null; currency: string | null; plan: string; reimbursement_enabled?: boolean; reimbursement_require_manager?: boolean; reimbursement_disabled?: boolean; weekend_days?: number[] | null; weekend_sat_alt?: string | null; shift_start?: string | null; shift_end?: string | null; late_grace_min?: number | null; logo_url?: string | null };

export async function getOrganization(orgId: string): Promise<OrgRow | null> {
  const { data, error } = await db().from('organizations').select('*').eq('id', orgId).single();
  if (error) throw error;
  return (data as OrgRow) ?? null;
}

export async function updateOrganization(orgId: string, fields: Partial<OrgRow>): Promise<void> {
  const { error } = await db().from('organizations').update(fields).eq('id', orgId);
  if (error) throw error;
}

// ── Org settings (JSON blob) + per-employee basic salary ───────────────
export async function getOrganizationSettings(orgId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db().from('organizations').select('settings').eq('id', orgId).single();
  if (error) throw error;
  return (data?.settings as Record<string, unknown>) ?? {};
}

/** Merge one section's value into organizations.settings (read-modify-write). */
export async function setOrganizationSetting(orgId: string, key: string, value: unknown): Promise<void> {
  const current = await getOrganizationSettings(orgId).catch(() => ({}));
  const { error } = await db().from('organizations').update({ settings: { ...current, [key]: value } }).eq('id', orgId);
  if (error) throw error;
}

export async function setEmployeeBasicSalary(employeeId: string, value: number): Promise<void> {
  const { error } = await db().from('employees').update({ basic_salary: value }).eq('id', employeeId);
  if (error) throw error;
}

// ── Payroll adjustments (HR ± unpaid-leave days, per employee per cycle) ──
export async function listPayrollAdjustments(orgId: string, cycle: string): Promise<Record<string, number>> {
  const { data, error } = await db().from('payroll_adjustments')
    .select('employee_id,adjust_days').eq('org_id', orgId).eq('cycle', cycle);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.employee_id as string] = Number(r.adjust_days) || 0;
  return out;
}

export async function savePayrollAdjustment(orgId: string, employeeId: string, cycle: string, adjustDays: number): Promise<void> {
  const { error } = await db().from('payroll_adjustments').upsert(
    { org_id: orgId, employee_id: employeeId, cycle, adjust_days: adjustDays, updated_at: new Date().toISOString() },
    { onConflict: 'org_id,employee_id,cycle' },
  );
  if (error) throw error;
}

/** Upload a workspace logo to the public 'branding' bucket; returns its public URL. */
export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${orgId}/logo-${Date.now()}.${ext}`;
  const { error } = await db().storage.from('branding').upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return db().storage.from('branding').getPublicUrl(path).data.publicUrl;
}

export async function addDepartments(orgId: string, names: string[]): Promise<void> {
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!clean.length) return;
  const { data, error: readError } = await db().from('departments').select('name').eq('org_id', orgId);
  if (readError) throw readError;
  const existing = new Set((data ?? []).map((row) => String(row.name).toLowerCase()));
  const rows = clean.filter((name) => !existing.has(name.toLowerCase())).map((name) => ({ org_id: orgId, name }));
  if (!rows.length) return;
  const { error } = await db().from('departments').insert(rows);
  if (error) throw error;
}

export async function addLeaveTypes(orgId: string, types: { name: string; quota: number }[]): Promise<void> {
  const clean = types
    .map((t) => ({ name: t.name.trim(), quota: t.quota }))
    .filter((t) => t.name);
  if (!clean.length) return;
  const { data, error: readError } = await db().from('leave_types').select('name').eq('org_id', orgId);
  if (readError) throw readError;
  const existing = new Set((data ?? []).map((row) => String(row.name).toLowerCase()));
  const rows = clean.filter((t) => !existing.has(t.name.toLowerCase())).map((t) => ({ org_id: orgId, name: t.name, quota: t.quota }));
  if (!rows.length) return;
  const { error } = await db().from('leave_types').insert(rows);
  if (error) throw error;
}

export async function addEmployees(orgId: string, emps: { name: string; email: string; dept: string; designation: string; manager: string }[]): Promise<void> {
  const valid = emps.filter((e) => e.name.trim());
  if (!valid.length) return;
  const { count, error: countError } = await db().from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
  if (countError) throw countError;
  const start = count ?? 0;
  const rows = valid.map((e, i) => ({
    org_id: orgId, code: `EMP-${String(start + i + 1).padStart(3, '0')}`,
    name: e.name.trim(), email: e.email.trim() || null, dept: e.dept || null,
    designation: e.designation || null, manager: e.manager || null, type: 'Full-time', status: 'Active',
  }));
  const { error } = await db().from('employees').insert(rows);
  if (error) throw error;
}

// ── Holidays ──────────────────────────────────────────────────────────
export async function listHolidays(): Promise<Holiday[]> {
  const { data, error } = await db().from('holidays').select('*').order('date');
  if (error) throw error;
  return (data ?? []) as Holiday[];
}

export async function addHoliday(orgId: string, h: Omit<Holiday, 'id'>): Promise<void> {
  const { error } = await db().from('holidays').insert({ org_id: orgId, ...h });
  if (error) throw error;
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await db().from('holidays').delete().eq('id', id);
  if (error) throw error;
}

// ── Leave requests + approval workflow ────────────────────────────────
export async function listLeave(): Promise<LeaveRow[]> {
  const { data, error } = await db().from('leave_requests').select('*').order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

function reportsTo(employee: Employee, manager: Employee | null, profile: ProfileLookup) {
  const managerNames = [manager?.name, profile.full_name, profile.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return !!employee.manager && managerNames.includes(employee.manager.trim().toLowerCase()) && employee.id !== manager?.id;
}

export async function listMyTeamLeave(profile: ProfileLookup, manager: Employee | null): Promise<LeaveRow[]> {
  const rpc = await db().rpc('get_my_team_leave_requests');
  if (!rpc.error) return (rpc.data ?? []) as LeaveRow[];
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  if (!manager && !profile.full_name && !profile.email) return [];
  const [leaveRows, employees] = await Promise.all([listLeave(), listEmployees()]);
  const team = new Map(
    employees
      .filter((employee) => reportsTo(employee, manager, profile))
      .flatMap((employee) => [[employee.id, employee], [employee.code, employee], [employee.name, employee]])
  );
  return leaveRows.filter((row) => {
    const keys = [row.employee_id, row.code, row.emp].filter(Boolean) as string[];
    return keys.some((key) => team.has(key));
  });
}

export async function decideLeave(row: LeaveRow, action: 'approve' | 'reject'): Promise<void> {
  const rpc = await db().rpc('decide_leave_request', { p_request_id: row.id, p_action: action });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  let patch: Record<string, unknown>;
  if (action === 'reject') {
    patch = { status: 'Rejected', stage: 'reject', decided_at: new Date().toISOString() };
  } else if (row.stage === 'manager') {
    // Manager approval forwards to HR.
    patch = { stage: 'hr', decided_at: new Date().toISOString() };
  } else {
    patch = { status: 'Approved', stage: 'done', decided_at: new Date().toISOString() };
  }
  const { error } = await db().from('leave_requests').update(patch).eq('id', row.id);
  if (error) throw error;

  if (row.employee_id && row.org_id && !sameText(row.type, COMP_OFF_TYPE)) {
    if (action === 'reject') await adjustLeaveBalance(row.org_id, row.employee_id, row.type, { pending: -num(row.days) });
    if (action === 'approve' && row.stage !== 'manager') await adjustLeaveBalance(row.org_id, row.employee_id, row.type, { pending: -num(row.days), used: num(row.days) });
  }
}

export async function decideTeamLeave(row: LeaveRow, action: 'approve' | 'reject'): Promise<void> {
  const rpc = await db().rpc('decide_team_leave_request', { p_request_id: row.id, p_action: action });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;
  await decideLeave(row, action);
}

/** Employee withdraws their own still-pending leave (releases the pending balance). */
export async function cancelLeave(id: string): Promise<void> {
  // Direct UPDATE is blocked by RLS for the requester (and the balance restore
  // too), so withdraw via a security-definer RPC that handles both.
  const { error } = await db().rpc('cancel_leave_request', { p_id: id });
  if (error) throw error;
}

// ── Dashboard stats ───────────────────────────────────────────────────
export async function dashboardStats(): Promise<Stats> {
  const s = db();
  const today = new Date().toISOString().slice(0, 10);
  const count = (q: { count: number | null }) => q.count ?? 0;
  const [emp, active, dept, pend, present] = await Promise.all([
    s.from('employees').select('id', { count: 'exact', head: true }),
    s.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
    s.from('departments').select('id', { count: 'exact', head: true }),
    s.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    s.from('attendance').select('id', { count: 'exact', head: true }).eq('day', today).eq('status', 'Present'),
  ]);
  return {
    employees: count(emp), active: count(active), departments: count(dept),
    pendingLeave: count(pend), presentToday: count(present),
  };
}

// ── Sample data seeder (client-side inserts; RLS-scoped to current org) ─
export async function hasEmployees(): Promise<boolean> {
  const { count } = await db().from('employees').select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

const SAMPLE_DEPTS = ['Engineering', 'Design', 'Sales', 'Operations', 'Finance'];
const SAMPLE_LEAVE_TYPES = [
  { name: 'Casual', quota: 12 },
  { name: 'Sick', quota: 8 },
  { name: 'Paid', quota: 15 },
  { name: 'Work from home', quota: 24 },
];
const SAMPLE_EMP = [
  { code: 'CTK-2041', name: 'Aarav Mehta', dept: 'Design', designation: 'Sr. Product Designer', manager: 'Priya Nair', type: 'Full-time', status: 'Active', email: 'aarav.mehta@acme.co', phone: '+91 98860 41122', joined: '2022-03-14' },
  { code: 'CTK-1088', name: 'Priya Nair', dept: 'Design', designation: 'Design Lead', manager: 'Rohan Kapoor', type: 'Full-time', status: 'Active', email: 'priya.nair@acme.co', phone: '+91 99001 23410', joined: '2021-01-02' },
  { code: 'CTK-3310', name: 'Vikram Singh', dept: 'Engineering', designation: 'Backend Engineer', manager: 'Neha Joshi', type: 'Full-time', status: 'Active', email: 'vikram.s@acme.co', phone: '+91 90042 88190', joined: '2023-06-20' },
  { code: 'CTK-2207', name: 'Sara Khan', dept: 'Sales', designation: 'Account Executive', manager: 'Imran Sheikh', type: 'Full-time', status: 'Active', email: 'sara.khan@acme.co', phone: '+91 98180 77654', joined: '2022-09-11' },
  { code: 'CTK-3402', name: 'Rahul Verma', dept: 'Engineering', designation: 'Frontend Engineer', manager: 'Neha Joshi', type: 'Full-time', status: 'Active', email: 'rahul.v@acme.co', phone: '+91 97411 56230', joined: '2024-02-03' },
  { code: 'CTK-1905', name: 'Neha Joshi', dept: 'Engineering', designation: 'Engineering Manager', manager: 'Rohan Kapoor', type: 'Full-time', status: 'Active', email: 'neha.j@acme.co', phone: '+91 99520 11876', joined: '2020-07-15' },
  { code: 'CTK-2618', name: 'Ananya Rao', dept: 'Operations', designation: 'Ops Associate', manager: 'Deepak Menon', type: 'Part-time', status: 'Active', email: 'ananya.r@acme.co', phone: '+91 90876 33421', joined: '2023-10-28' },
  { code: 'CTK-2950', name: 'Karan Patel', dept: 'Finance', designation: 'Financial Analyst', manager: 'Deepak Menon', type: 'Full-time', status: 'Inactive', email: 'karan.p@acme.co', phone: '+91 98330 90011', joined: '2022-04-19' },
];
const SAMPLE_LEAVE = [
  { emp: 'Aarav Mehta', code: 'CTK-2041', dept: 'Design', type: 'Casual', from_date: '2026-06-12', to_date: '2026-06-13', days: 2, half: false, status: 'Pending', stage: 'manager', reason: 'Family function out of town.' },
  { emp: 'Vikram Singh', code: 'CTK-3310', dept: 'Engineering', type: 'Sick', from_date: '2026-06-09', to_date: '2026-06-10', days: 2, half: false, status: 'Pending', stage: 'manager', reason: 'Viral fever, doctor advised rest.', attachment: 'medical-certificate.pdf' },
  { emp: 'Sara Khan', code: 'CTK-2207', dept: 'Sales', type: 'Work from home', from_date: '2026-06-11', to_date: '2026-06-11', days: 1, half: false, status: 'Pending', stage: 'hr', reason: 'Electrician visit; available online.' },
  { emp: 'Rahul Verma', code: 'CTK-3402', dept: 'Engineering', type: 'Paid', from_date: '2026-06-16', to_date: '2026-06-20', days: 5, half: false, status: 'Pending', stage: 'manager', reason: 'Pre-planned vacation, handover shared.' },
  { emp: 'Ananya Rao', code: 'CTK-2618', dept: 'Operations', type: 'Casual', from_date: '2026-06-06', to_date: '2026-06-06', days: 0.5, half: true, status: 'Pending', stage: 'hr', reason: 'Bank appointment.' },
  { emp: 'Priya Nair', code: 'CTK-1088', dept: 'Design', type: 'Paid', from_date: '2026-05-28', to_date: '2026-05-30', days: 3, half: false, status: 'Approved', stage: 'done', reason: 'Short personal trip.' },
];
const SAMPLE_HOLIDAYS = [
  { name: 'Independence Day', date: '2026-08-15', type: 'National', description: 'National holiday' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'National', description: 'National holiday' },
  { name: 'Diwali', date: '2026-10-20', type: 'Festival', description: 'Festival of lights' },
  { name: 'Christmas', date: '2026-12-25', type: 'Festival', description: 'Festival holiday' },
];

export async function seedSampleData(orgId: string): Promise<void> {
  const s = db();
  await addDepartments(orgId, SAMPLE_DEPTS);
  await addLeaveTypes(orgId, SAMPLE_LEAVE_TYPES);

  const { data: employees, error: empError } = await s
    .from('employees')
    .insert(SAMPLE_EMP.map((e) => ({ org_id: orgId, ...e })))
    .select('*');
  if (empError) throw empError;

  const byCode = new Map((employees ?? []).map((e) => [e.code, e as Employee]));
  const leaveRows = SAMPLE_LEAVE.map((l) => ({
    org_id: orgId,
    employee_id: l.code ? byCode.get(l.code)?.id ?? null : null,
    ...l,
  }));
  const { error: leaveError } = await s.from('leave_requests').insert(leaveRows);
  if (leaveError) throw leaveError;

  const usage = new Map<string, { used: number; pending: number }>();
  for (const l of SAMPLE_LEAVE) {
    const key = `${l.code}:${l.type}`;
    const current = usage.get(key) ?? { used: 0, pending: 0 };
    if (l.status === 'Approved') current.used += Number(l.days);
    if (l.status === 'Pending') current.pending += Number(l.days);
    usage.set(key, current);
  }
  const balanceRows = (employees ?? []).flatMap((e) => SAMPLE_LEAVE_TYPES.map((t) => {
    const current = usage.get(`${e.code}:${t.name}`) ?? { used: 0, pending: 0 };
    return { org_id: orgId, employee_id: e.id, code: e.code, name: e.name, type: t.name, allotted: t.quota, used: current.used, pending: current.pending };
  }));
  if (balanceRows.length) {
    const { data: existing, error: existingError } = await s
      .from('leave_balances')
      .select('employee_id,type')
      .eq('org_id', orgId);
    if (existingError) throw existingError;
    const existingKeys = new Set((existing ?? []).map((row) => `${row.employee_id}:${String(row.type).toLowerCase()}`));
    const missing = balanceRows.filter((row) => !existingKeys.has(`${row.employee_id}:${row.type.toLowerCase()}`));
    const { error } = missing.length ? await s.from('leave_balances').insert(missing) : { error: null };
    if (error) throw error;
  }

  const today = new Date();
  const attendanceRows = (employees ?? [])
    .filter((e) => e.status === 'Active')
    .flatMap((e, employeeIndex) => Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(today);
      day.setDate(today.getDate() - dayIndex);
      const isWeekend = [0, 6].includes(day.getDay());
      const checkIn = new Date(day);
      checkIn.setHours(9, 20 + ((employeeIndex + dayIndex) % 25), 0, 0);
      const checkOut = new Date(day);
      checkOut.setHours(isWeekend ? 13 : 18, isWeekend ? 30 : 20 + ((employeeIndex + dayIndex) % 25), 0, 0);
      return {
        org_id: orgId,
        employee_id: e.id,
        day: isoDate(day),
        check_in_at: checkIn.toISOString(),
        check_out_at: dayIndex === 0 ? null : checkOut.toISOString(),
        status: isWeekend ? 'WFH' : ((employeeIndex + dayIndex) % 6 === 0 ? 'Late' : 'Present'),
        work_seconds: dayIndex === 0 ? 0 : Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 1000)),
        location: 'HQ Bengaluru',
      };
    }));
  if (attendanceRows.length) {
    const { error } = await s.from('attendance').insert(attendanceRows);
    if (error) throw error;
  }

  const { error: holidayError } = await s.from('holidays').insert(SAMPLE_HOLIDAYS.map((h) => ({ org_id: orgId, ...h })));
  if (holidayError) throw holidayError;
}

// Employee self-service: attendance, own leave, and balances.
function leaveOwnerQuery(profile: ProfileLookup, employee: Employee | null) {
  const q = db().from('leave_requests').select('*').order('applied_at', { ascending: false });
  if (employee?.id) return q.eq('employee_id', employee.id);
  if (employee?.name) return q.eq('emp', employee.name);
  if (profile.email) return q.eq('emp', profile.full_name || profile.email);
  return q.eq('emp', profile.full_name || '');
}

async function ensureEmployeeLeaveBalancesClient(orgId: string, employee: Employee): Promise<void> {
  const [types, existing] = await Promise.all([
    listLeaveTypes(),
    db()
      .from('leave_balances')
      .select('type')
      .eq('org_id', orgId)
      .eq('employee_id', employee.id),
  ]);
  if (existing.error) throw existing.error;
  const seen = new Set((existing.data ?? []).map((row) => String(row.type).toLowerCase()));
  const rows = types
    .filter((t) => !seen.has(t.name.toLowerCase()))
    .map((t) => ({
      org_id: orgId,
      employee_id: employee.id,
      code: employee.code,
      name: employee.name,
      type: t.name,
      allotted: num(t.quota),
      used: 0,
      pending: 0,
    }));
  if (!rows.length) return;
  const { error } = await db().from('leave_balances').insert(rows);
  if (error) throw error;
}

async function adjustLeaveBalance(orgId: string, employeeId: string, type: string, delta: { used?: number; pending?: number }) {
  const { data, error } = await db()
    .from('leave_balances')
    .select('id,used,pending')
    .eq('org_id', orgId)
    .eq('employee_id', employeeId)
    .eq('type', type)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  const { error: updateError } = await db().from('leave_balances').update({
    used: Math.max(0, num(data.used) + num(delta.used)),
    pending: Math.max(0, num(data.pending) + num(delta.pending)),
  }).eq('id', data.id);
  if (updateError) throw updateError;
}

export async function applyLeave(orgId: string, p: {
  employee: Employee | null;
  empName: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  half: boolean;
  reason: string;
  attachment?: string | null;
}): Promise<void> {
  // Comp off draws from earned extra-work days (derived), not a leave_balances
  // row — skip the RPC/quota path and insert directly (client validates balance).
  const isCompOff = sameText(p.type, COMP_OFF_TYPE);
  if (p.employee?.id && !isCompOff) {
    const rpc = await db().rpc('apply_leave_request', {
      p_type: p.type,
      p_from_date: p.fromDate,
      p_to_date: p.half ? p.fromDate : p.toDate,
      p_days: p.days,
      p_half: p.half,
      p_reason: p.reason || null,
      p_attachment: p.attachment || null,
    });
    if (!rpc.error) return;
    if (!isMissingRpcError(rpc.error)) throw rpc.error;

    const balances = await myLeaveBalances(orgId, p.employee);
    const balance = balances.find((b) => sameText(b.type, p.type));
    if (!balance) throw new Error('This leave type is not configured for your profile.');
    if (num(p.days) > balance.available) {
      throw new Error(`Only ${balance.available} ${balance.type} leave day${balance.available === 1 ? '' : 's'} are available.`);
    }
  }

  const { error } = await db().from('leave_requests').insert({
    org_id: orgId,
    employee_id: p.employee?.id ?? null,
    emp: p.employee?.name || p.empName,
    code: p.employee?.code ?? null,
    dept: p.employee?.dept ?? null,
    type: p.type,
    from_date: p.fromDate,
    to_date: p.half ? p.fromDate : p.toDate,
    days: p.days,
    half: p.half,
    reason: p.reason || null,
    attachment: p.attachment || null,
    status: 'Pending',
    stage: 'manager',
  });
  if (error) throw error;
  if (p.employee?.id && !isCompOff) await adjustLeaveBalance(orgId, p.employee.id, p.type, { pending: p.days });
}

// Comp-off credits earned = distinct attendance days on a weekend/holiday
// (all-time). Lightweight: fetches only the `day` column.
export async function compOffEarned(employee: Employee | null, holidayDates: string[], cfg: WeekendConfig = DEFAULT_WEEKEND): Promise<number> {
  if (!employee?.id) return 0;
  const { data, error } = await db().from('attendance').select('day').eq('employee_id', employee.id);
  if (error) throw error;
  return countExtraDays((data ?? []).map((r) => r.day as string), new Set(holidayDates), cfg);
}

export async function myLeave(profile: ProfileLookup, employee: Employee | null): Promise<LeaveRow[]> {
  const { data, error } = await leaveOwnerQuery(profile, employee);
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

export async function myLeaveBalances(orgId: string, employee: Employee | null, leaveRows?: LeaveRow[]): Promise<LeaveBalance[]> {
  const s = db();
  if (employee?.id) {
    const rpc = await s.rpc('get_my_leave_balances');
    if (!rpc.error) return ((rpc.data ?? []) as Record<string, unknown>[]).map(mapBalance);
    if (!isMissingRpcError(rpc.error)) throw rpc.error;

    await ensureEmployeeLeaveBalancesClient(orgId, employee).catch(() => undefined);
    const [balances, types] = await Promise.all([
      s.from('leave_balances').select('*').eq('org_id', orgId).eq('employee_id', employee.id),
      listLeaveTypes(),
    ]);
    const { data, error } = balances;
    if (error) throw error;
    if ((data ?? []).length) {
      const colorByType = new Map(types.map((t) => [t.name.toLowerCase(), t.color]));
      return (data ?? []).map((row) => mapBalance({ ...row, color: colorByType.get(String(row.type).toLowerCase()) ?? null }));
    }
  }

  const [types, rows] = await Promise.all([
    listLeaveTypes(),
    leaveRows ? Promise.resolve(leaveRows) : employee ? myLeave({ id: '', org_id: orgId, full_name: employee.name, email: employee.email }, employee) : Promise.resolve([]),
  ]);
  return types
    .map((t) => {
      const relevant = rows.filter((r) => r.type === t.name);
      const used = relevant.filter((r) => r.status === 'Approved').reduce((sum, r) => sum + num(r.days), 0);
      const pending = relevant.filter((r) => r.status === 'Pending').reduce((sum, r) => sum + num(r.days), 0);
      return { type: t.name, allotted: num(t.quota), used, pending, available: Math.max(0, num(t.quota) - used - pending), color: t.color };
    });
}

// Attendance rows for one calendar month (month is 0-based), newest first.
export async function listMyAttendanceMonth(orgId: string, employee: Employee | null, year: number, month: number): Promise<AttendanceRow[]> {
  if (!employee?.id) return [];
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
  const { data, error } = await db().from('attendance').select('*')
    .eq('org_id', orgId).eq('employee_id', employee.id)
    .gte('day', start).lte('day', end).order('day', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function listMyAttendance(orgId: string, employee: Employee | null, limit = 45): Promise<AttendanceRow[]> {
  if (!employee?.id) return [];
  const { data, error } = await db()
    .from('attendance')
    .select('*')
    .eq('org_id', orgId)
    .eq('employee_id', employee.id)
    .order('day', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

export async function getTodayAttendance(orgId: string, employee: Employee | null, day = isoDate(new Date())): Promise<AttendanceRow | null> {
  if (!employee?.id) return null;
  const { data, error } = await db()
    .from('attendance')
    .select('*')
    .eq('org_id', orgId)
    .eq('employee_id', employee.id)
    .eq('day', day)
    .maybeSingle();
  if (error) throw error;
  return (data as AttendanceRow | null) ?? null;
}

export async function checkIn(orgId: string, employee: Employee | null, details?: AttendanceDetails): Promise<AttendanceRow> {
  const checkedAt = details?.checkedAt ? new Date(details.checkedAt) : new Date();
  const day = isoDate(checkedAt);
  const auditDetails = {
    location: details?.location ?? null,
    selfie_url: details?.selfie_url ?? null,
    ip: details?.ip ?? null,
    device: details?.device ?? null,
    lat: details?.lat ?? null,
    lng: details?.lng ?? null,
  };
  const existing = await getTodayAttendance(orgId, employee, day);
  if (existing) {
    // Keep nulls out, but 0 is a valid coordinate — only drop null/undefined/''.
    const patch = Object.fromEntries(Object.entries(auditDetails).filter(([, value]) => value !== null && value !== undefined && value !== ''));
    if (!Object.keys(patch).length) return existing;
    const { data, error } = await db().from('attendance').update(patch).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data as AttendanceRow;
  }
  const { data, error } = await db().from('attendance').insert({
    org_id: orgId,
    employee_id: employee?.id ?? null,
    day,
    check_in_at: checkedAt.toISOString(),
    status: 'Present',
    ...auditDetails,
  }).select('*').single();
  if (error) throw error;
  return data as AttendanceRow;
}

export async function checkOut(attendanceId: string, workSeconds: number, details?: AttendanceDetails): Promise<void> {
  const checkedAt = details?.checkedAt ? new Date(details.checkedAt) : new Date();
  // Write the check-out location to its own columns so the check-in location
  // (location/lat/lng) is preserved. 0 is a valid coordinate — only drop
  // null/undefined/'' rather than all falsy values.
  const patch = {
    check_out_at: checkedAt.toISOString(),
    work_seconds: Math.round(workSeconds),
    ...Object.fromEntries(Object.entries({
      checkout_location: details?.location,
      checkout_lat: details?.lat,
      checkout_lng: details?.lng,
      ip: details?.ip,
      device: details?.device,
    }).filter(([, value]) => value !== null && value !== undefined && value !== '')),
  };
  const { error } = await db().from('attendance').update(patch).eq('id', attendanceId);
  if (error) throw error;
}

// ── Notifications ─────────────────────────────────────────────────────
export type Notification = {
  id: string; type: string; title: string; body: string | null; read: boolean; created_at: string;
};

// Register a device's FCM token so the server can push notifications to it.
export async function saveDeviceToken(token: string, platform = 'android'): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('device_tokens').upsert({ user_id: user.id, token, platform }, { onConflict: 'token' });
}

export async function listNotifications(limit = 200): Promise<Notification[]> {
  const { data, error } = await db().from('notifications')
    .select('id,type,title,body,read,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db().from('notifications').update({ read: true }).eq('read', false);
  if (error) throw error;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db().from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

// ── Reimbursements ────────────────────────────────────────────────────
export type ReimbursementFile = { path: string; name: string; size: number };
export type Reimbursement = {
  id: string; org_id: string; employee_id: string | null; profile_id: string | null;
  emp: string | null; code: string | null; dept: string | null;
  category: string; amount: number; spent_on: string; reason: string | null;
  attachments: ReimbursementFile[]; status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  stage: string; paid_at: string | null; paid_ref: string | null; created_at: string;
};

const RECEIPTS_BUCKET = 'receipts';

async function currentUid(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

export function signedReceiptUrl(path: string, expiresIn = 3600): Promise<string | null> {
  return db().storage.from(RECEIPTS_BUCKET).createSignedUrl(path, expiresIn)
    .then(({ data }) => data?.signedUrl ?? null);
}

export async function uploadReceipts(orgId: string, files: File[]): Promise<ReimbursementFile[]> {
  if (!files.length) return [];
  const uid = (await currentUid()) ?? 'anon';
  const out: ReimbursementFile[] = [];
  for (const file of files) {
    const path = `${orgId}/${uid}/${Date.now()}-${safeName(file.name)}`;
    const { error } = await db().storage.from(RECEIPTS_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    out.push({ path, name: file.name, size: file.size });
  }
  return out;
}

export async function listReimbursements(): Promise<Reimbursement[]> {
  const { data, error } = await db().from('reimbursements').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Reimbursement[];
}

export async function myReimbursements(): Promise<Reimbursement[]> {
  const uid = await currentUid();
  if (!uid) return [];
  const { data, error } = await db().from('reimbursements').select('*')
    .eq('profile_id', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Reimbursement[];
}

export async function applyReimbursement(orgId: string, p: {
  employee: Employee | null;
  empName: string;
  category: string;
  amount: number;
  spentOn: string;
  reason: string;
  files: File[];
  requireManager: boolean;
}): Promise<void> {
  const attachments = await uploadReceipts(orgId, p.files);
  const stage = p.requireManager && p.employee?.manager ? 'manager' : 'hr';
  const { error } = await db().from('reimbursements').insert({
    org_id: orgId,
    employee_id: p.employee?.id ?? null,
    emp: p.employee?.name || p.empName,
    code: p.employee?.code ?? null,
    dept: p.employee?.dept ?? null,
    category: p.category,
    amount: p.amount,
    spent_on: p.spentOn,
    reason: p.reason || null,
    attachments,
    status: 'Pending',
    stage,
  });
  if (error) throw error;
}

export async function decideReimbursement(row: Reimbursement, action: 'approve' | 'reject'): Promise<void> {
  const uid = await currentUid();
  let patch: Record<string, unknown>;
  if (action === 'reject') {
    patch = { status: 'Rejected', stage: 'reject', hr_decided_by: uid };
  } else if (row.stage === 'manager') {
    patch = { stage: 'hr', manager_decided_by: uid };
  } else {
    patch = { status: 'Approved', stage: 'done', hr_decided_by: uid };
  }
  const { error } = await db().from('reimbursements').update(patch).eq('id', row.id);
  if (error) throw error;
}

export async function bulkDecideReimbursements(rows: Reimbursement[], action: 'approve' | 'reject'): Promise<void> {
  for (const row of rows) await decideReimbursement(row, action);
}

/** Owner/HR only: permanently delete a claim and its receipt files. */
export async function deleteReimbursement(row: Reimbursement): Promise<void> {
  const paths = (row.attachments ?? []).map((a) => a.path).filter(Boolean);
  if (paths.length) await db().storage.from(RECEIPTS_BUCKET).remove(paths).catch(() => undefined);
  const { error } = await db().from('reimbursements').delete().eq('id', row.id);
  if (error) throw error;
}

export async function markReimbursementsPaid(rows: Reimbursement[], ref?: string): Promise<void> {
  const uid = await currentUid();
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  const { error } = await db().from('reimbursements')
    .update({ status: 'Paid', stage: 'done', paid_at: new Date().toISOString(), paid_by: uid, paid_ref: ref || null })
    .in('id', ids);
  if (error) throw error;
}

/** Employee withdraws their own still-pending reimbursement claim. */
export async function cancelReimbursement(id: string): Promise<void> {
  const { error } = await db().from('reimbursements').update({ status: 'Cancelled', stage: 'done' }).eq('id', id).eq('status', 'Pending');
  if (error) throw error;
}

// ── Announcements ─────────────────────────────────────────────────────
export type Announcement = {
  id: string; org_id: string; created_by: string | null; author: string | null;
  title: string; body: string; pinned: boolean; created_at: string;
};
export type AnnouncementRead = { announcement_id: string; user_id: string; read_at: string };

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await db().from('announcements').select('*')
    .order('pinned', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

export async function createAnnouncement(orgId: string, p: { title: string; body: string; author?: string | null; pinned?: boolean }): Promise<void> {
  const { error } = await db().from('announcements').insert({
    org_id: orgId, title: p.title, body: p.body, author: p.author ?? null, pinned: !!p.pinned,
  });
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await db().from('announcements').delete().eq('id', id);
  if (error) throw error;
}

/** Reads visible to the caller: an employee sees their own; an admin sees all. */
export async function listAnnouncementReads(): Promise<AnnouncementRead[]> {
  const { data, error } = await db().from('announcement_reads').select('announcement_id,user_id,read_at');
  if (error) throw error;
  return (data ?? []) as AnnouncementRead[];
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const uid = await currentUid();
  if (!uid) return;
  const { error } = await db().from('announcement_reads')
    .upsert({ announcement_id: id, user_id: uid }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}
