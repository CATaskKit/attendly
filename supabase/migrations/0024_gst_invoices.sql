-- GST tax invoices. Adds customer billing identity to organizations, an
-- immutable invoices table (one row per payment, with a snapshot of both
-- parties and the CGST/SGST/IGST split), and a per-financial-year serial
-- allocator. Numbers written only by Edge Functions on the service_role key.

-- ── Customer billing identity (admin-editable; NOT billing-locked) ─────
alter table organizations add column if not exists legal_name      text;
alter table organizations add column if not exists gstin           text;
alter table organizations add column if not exists billing_state   text;
alter table organizations add column if not exists billing_address text;
alter table organizations add column if not exists billing_pincode text;

-- ── Per-financial-year (Apr–Mar) consecutive serial ───────────────────
create table if not exists invoice_counters (
  fy        text primary key,          -- e.g. '26-27'
  last_seq  integer not null default 0
);
alter table invoice_counters enable row level security; -- service_role only

-- Atomically bump and return the next number for the invoice's financial year.
-- Local variables are v_-prefixed so they never collide with the invoice_counters
-- columns (e.g. `fy`), which would make `on conflict (fy)` ambiguous.
create or replace function public.allocate_invoice_no(inv_date timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year  int := extract(year  from inv_date at time zone 'Asia/Kolkata');
  v_month int := extract(month from inv_date at time zone 'Asia/Kolkata');
  v_start int;
  v_fy    text;
  v_seq   int;
begin
  v_start := case when v_month >= 4 then v_year else v_year - 1 end;   -- Indian FY starts April
  v_fy := lpad((v_start % 100)::text, 2, '0') || '-' || lpad(((v_start + 1) % 100)::text, 2, '0');
  insert into invoice_counters (fy, last_seq) values (v_fy, 1)
    on conflict (fy) do update set last_seq = invoice_counters.last_seq + 1
    returning last_seq into v_seq;
  return 'CTK/' || v_fy || '/' || lpad(v_seq::text, 4, '0');
end $$;

revoke execute on function public.allocate_invoice_no(timestamptz) from public;
grant  execute on function public.allocate_invoice_no(timestamptz) to service_role;

-- ── Invoices (immutable snapshot) ─────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  payment_id     text unique references billing_payments (payment_id),
  invoice_no     text unique not null,
  invoice_date   timestamptz not null default now(),
  -- supplier snapshot
  supplier_name    text not null,
  supplier_gstin   text not null,
  supplier_address text not null,
  supplier_state   text not null,
  -- customer snapshot
  customer_name    text not null,
  customer_gstin   text,
  customer_state   text,
  customer_address text,
  -- money (INR)
  sac_code       text not null default '997331',
  taxable_value  numeric not null,
  cgst           numeric not null default 0,
  sgst           numeric not null default 0,
  igst           numeric not null default 0,
  total          numeric not null,
  place_of_supply text,
  created_at     timestamptz not null default now()
);

alter table invoices enable row level security;
drop policy if exists invoices_select on invoices;
create policy invoices_select on invoices
  for select using (org_id = current_org_id() and is_admin());
-- No insert/update/delete policies: only the service_role (Edge Functions)
-- writes invoices, and invoices are never mutated once issued.
