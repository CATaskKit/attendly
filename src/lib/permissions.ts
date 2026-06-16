import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Role } from './auth';

// Source of truth for the admin role/permission matrix. Both the Settings editor
// (Settings → Roles & permissions) and the enforcement in the admin console read
// these, so the labels stay in sync.

export const PERMISSIONS = [
  'View dashboard', 'Manage employees', 'Approve leave', 'Run payroll MIS',
  'Manage holidays', 'Edit settings', 'View audit logs',
] as const;
export type Permission = typeof PERMISSIONS[number];

// Matrix columns. The live system has owner/hr/manager/employee; "Company Admin"
// is kept for parity with the original design but no account uses it.
export const PERM_ROLES = ['Owner', 'Company Admin', 'HR', 'Manager', 'Employee'] as const;

// Default access, one flag per PERM_ROLES column. Used until an org saves its own.
export const DEFAULT_PERMS: Record<Permission, number[]> = {
  'View dashboard':   [1, 1, 1, 1, 0],
  'Manage employees': [1, 1, 1, 0, 0],
  'Approve leave':    [1, 1, 1, 1, 0],
  'Run payroll MIS':  [1, 1, 0, 0, 0],
  'Manage holidays':  [1, 1, 1, 0, 0],
  'Edit settings':    [1, 1, 0, 0, 0],
  'View audit logs':  [1, 1, 0, 0, 0],
};

export type PermMatrix = Record<string, Record<string, boolean>>;

export function roleColumn(role: Role): typeof PERM_ROLES[number] {
  return role === 'owner' ? 'Owner' : role === 'hr' ? 'HR' : role === 'manager' ? 'Manager' : 'Employee';
}

export function canDo(matrix: PermMatrix | null, role: Role, perm: Permission): boolean {
  if (role === 'owner') return true; // Owner permissions are locked on
  const col = roleColumn(role);
  const explicit = matrix?.[perm]?.[col];
  if (explicit !== undefined) return explicit;
  return !!DEFAULT_PERMS[perm][PERM_ROLES.indexOf(col)];
}

// Loads an org's saved matrix (or null → defaults) and returns a `can()` checker.
export function usePermissions(orgId: string | null, role: Role) {
  const [matrix, setMatrix] = useState<PermMatrix | null>(null);
  useEffect(() => {
    let active = true;
    if (!supabase || !orgId) { setMatrix(null); return; }
    supabase.from('role_permissions').select('matrix').eq('org_id', orgId).maybeSingle()
      .then(({ data }) => { if (active) setMatrix((data?.matrix as PermMatrix) ?? null); });
    return () => { active = false; };
  }, [orgId]);
  return { matrix, can: (perm: Permission) => canDo(matrix, role, perm) };
}
