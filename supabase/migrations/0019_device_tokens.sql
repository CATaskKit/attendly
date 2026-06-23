-- Stores each user's FCM device tokens so the send-push function can deliver
-- real push notifications to their phone(s).
create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text default 'android',
  created_at timestamptz not null default now(),
  unique (token)
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- A user manages only their own device tokens. The send-push Edge Function uses
-- the service role, which bypasses RLS to read everyone's tokens.
drop policy if exists device_tokens_self on public.device_tokens;
create policy device_tokens_self on public.device_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
