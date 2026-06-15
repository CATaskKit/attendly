-- ──────────────────────────────────────────────────────────────────────────
-- Role & permission matrix (admin Settings → Roles & permissions)
--
-- One row per organization holding the permission grid as JSON, so the matrix
-- is shared across all of an org's admins instead of living in one browser's
-- localStorage. Stored keyed by permission → role → boolean so it survives
-- changes to the permission/role lists.
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.role_permissions (
  org_id     uuid primary key references organizations (id) on delete cascade,
  matrix     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.role_permissions enable row level security;

-- Anyone in the org may read the matrix (the app may gate UI on it).
drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select using (org_id = current_org_id());

-- Only org admins (owner / hr) may change it.
drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all using (org_id = current_org_id() and is_admin())
  with check (org_id = current_org_id() and is_admin());
