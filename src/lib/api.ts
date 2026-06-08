import { supabase } from './supabase';

export type Employee = {
  id: string; code: string; name: string; dept: string | null; designation: string | null;
  manager: string | null; type: string | null; status: string; email: string | null;
  phone: string | null; joined: string | null;
};

export type LeaveRow = {
  id: string; emp: string | null; code: string | null; dept: string | null; type: string;
  from_date: string | null; to_date: string | null; days: number; half: boolean;
  reason: string | null; attachment: string | null; status: string; stage: string; applied_at: string;
};

export type Dept = { id: string; name: string };
export type Holiday = { id: string; name: string; date: string; type: string; description: string | null };

export type Stats = {
  employees: number; active: number; departments: number; pendingLeave: number; presentToday: number;
};

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
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

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await db().from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ── Departments ───────────────────────────────────────────────────────
export async function listDepartments(): Promise<Dept[]> {
  const { data, error } = await db().from('departments').select('id,name').order('name');
  if (error) throw error;
  return (data ?? []) as Dept[];
}

// ── Organization + onboarding writes ──────────────────────────────────
export type OrgRow = { id: string; name: string; display_name: string | null; industry: string | null; country: string | null; timezone: string | null; currency: string | null; plan: string };

export async function getOrganization(orgId: string): Promise<OrgRow | null> {
  const { data, error } = await db().from('organizations').select('*').eq('id', orgId).single();
  if (error) throw error;
  return (data as OrgRow) ?? null;
}

export async function updateOrganization(orgId: string, fields: Partial<OrgRow>): Promise<void> {
  const { error } = await db().from('organizations').update(fields).eq('id', orgId);
  if (error) throw error;
}

export async function addDepartments(orgId: string, names: string[]): Promise<void> {
  const rows = names.map((n) => n.trim()).filter(Boolean).map((name) => ({ org_id: orgId, name }));
  if (!rows.length) return;
  const { error } = await db().from('departments').insert(rows);
  if (error) throw error;
}

export async function addLeaveTypes(orgId: string, types: { name: string; quota: number }[]): Promise<void> {
  const rows = types.filter((t) => t.name.trim()).map((t) => ({ org_id: orgId, name: t.name.trim(), quota: t.quota }));
  if (!rows.length) return;
  const { error } = await db().from('leave_types').insert(rows);
  if (error) throw error;
}

export async function addEmployees(orgId: string, emps: { name: string; email: string; dept: string; designation: string; manager: string }[]): Promise<void> {
  const valid = emps.filter((e) => e.name.trim());
  const rows = valid.map((e, i) => ({
    org_id: orgId, code: `EMP-${String(i + 1).padStart(3, '0')}`,
    name: e.name.trim(), email: e.email.trim() || null, dept: e.dept || null,
    designation: e.designation || null, manager: e.manager || null, type: 'Full-time', status: 'Active',
  }));
  if (!rows.length) return;
  const { error } = await db().from('employees').insert(rows);
  if (error) throw error;
}

// ── Holidays ──────────────────────────────────────────────────────────
export async function listHolidays(): Promise<Holiday[]> {
  const { data, error } = await db().from('holidays').select('*').order('date');
  if (error) throw error;
  return (data ?? []) as Holiday[];
}

// ── Leave requests + approval workflow ────────────────────────────────
export async function listLeave(): Promise<LeaveRow[]> {
  const { data, error } = await db().from('leave_requests').select('*').order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

export async function decideLeave(row: LeaveRow, action: 'approve' | 'reject'): Promise<void> {
  let patch: Record<string, unknown>;
  if (action === 'reject') {
    patch = { status: 'Rejected', stage: 'reject', decided_at: new Date().toISOString() };
  } else if (row.stage === 'manager') {
    // manager approval forwards to HR
    patch = { stage: 'hr', decided_at: new Date().toISOString() };
  } else {
    patch = { status: 'Approved', stage: 'done', decided_at: new Date().toISOString() };
  }
  const { error } = await db().from('leave_requests').update(patch).eq('id', row.id);
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
  await s.from('departments').insert(SAMPLE_DEPTS.map((name) => ({ org_id: orgId, name })));
  await s.from('employees').insert(SAMPLE_EMP.map((e) => ({ org_id: orgId, ...e })));
  await s.from('leave_requests').insert(SAMPLE_LEAVE.map((l) => ({ org_id: orgId, ...l })));
  await s.from('holidays').insert(SAMPLE_HOLIDAYS.map((h) => ({ org_id: orgId, ...h })));
}

// ── Employee self-service (attendance + own leave) ─────────────────────
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function applyLeave(orgId: string, p: { empName: string; type: string; days: number; half: boolean; reason: string }): Promise<void> {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + Math.max(0, Math.ceil(p.days) - 1));
  const { error } = await db().from('leave_requests').insert({
    org_id: orgId, emp: p.empName, type: p.type, from_date: isoDate(from), to_date: isoDate(to),
    days: p.days, half: p.half, reason: p.reason, status: 'Pending', stage: 'manager',
  });
  if (error) throw error;
}

export async function myLeave(empName: string): Promise<LeaveRow[]> {
  const { data, error } = await db().from('leave_requests').select('*').eq('emp', empName).order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

export async function checkIn(orgId: string): Promise<string> {
  const { data, error } = await db().from('attendance').insert({
    org_id: orgId, day: isoDate(new Date()), check_in_at: new Date().toISOString(), status: 'Present',
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function checkOut(attendanceId: string, workSeconds: number): Promise<void> {
  const { error } = await db().from('attendance').update({
    check_out_at: new Date().toISOString(), work_seconds: Math.round(workSeconds),
  }).eq('id', attendanceId);
  if (error) throw error;
}
