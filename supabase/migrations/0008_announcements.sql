-- Announcements: owner/HR post a message; every employee in the org gets an
-- in-app notification and can open & read it. Read receipts are tracked per
-- user. Run after 0007_reimb_delete.sql.

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations (id) on delete cascade,
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  author     text,
  title      text not null,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists announcements_org_idx on announcements (org_id, created_at desc);

-- Per-user read receipts.
create table if not exists announcement_reads (
  announcement_id uuid not null references announcements (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table announcements      enable row level security;
alter table announcement_reads enable row level security;

-- Announcements: everyone in the org reads; only owner/HR write/manage.
drop policy if exists ann_select on announcements;
create policy ann_select on announcements for select using (org_id = current_org_id());
drop policy if exists ann_insert on announcements;
create policy ann_insert on announcements for insert with check (org_id = current_org_id() and is_admin());
drop policy if exists ann_update on announcements;
create policy ann_update on announcements for update using (org_id = current_org_id() and is_admin());
drop policy if exists ann_delete on announcements;
create policy ann_delete on announcements for delete using (org_id = current_org_id() and is_admin());

-- Read receipts: a user manages their own; admins can read all (to see who's read).
drop policy if exists ann_reads_select on announcement_reads;
create policy ann_reads_select on announcement_reads for select
  using (user_id = auth.uid() or exists (select 1 from announcements a where a.id = announcement_id and a.org_id = current_org_id() and is_admin()));
drop policy if exists ann_reads_insert on announcement_reads;
create policy ann_reads_insert on announcement_reads for insert with check (user_id = auth.uid());

-- New announcement → notify every member of the org (except the author).
create or replace function public.notify_on_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (org_id, user_id, type, title, body)
  select NEW.org_id, p.id, 'announcement',
         NEW.title,
         left(NEW.body, 140) || case when length(NEW.body) > 140 then '…' else '' end
  from profiles p
  where p.org_id = NEW.org_id
    and p.id <> coalesce(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  return NEW;
end $$;

drop trigger if exists trg_announcement_notify on announcements;
create trigger trg_announcement_notify after insert on announcements
  for each row execute function public.notify_on_announcement();

-- Realtime so the bell + lists update live.
do $$ begin
  alter publication supabase_realtime add table announcements;
exception when others then null; end $$;
