-- Auto check-out: close attendance rows an employee left open past their day,
-- using each org's policy in settings.attendancePolicy.autoCheckout:
--   'off'   → do nothing
--   'hours' → check_out = check_in + autoHours hours
--   'time'  → check_out = that day at autoTime (Asia/Kolkata)
-- No location is recorded (it's an automatic close). Times are evaluated in IST.
--
-- Run manually any time:   select public.auto_checkout_stale();
-- Schedule it (see bottom) once pg_cron is enabled.
create or replace function public.auto_checkout_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r    record;
  pol  jsonb;
  mode text;
  hrs  numeric;
  tstr text;
  co   timestamptz;
  n    integer := 0;
begin
  for r in
    select a.id, a.org_id, a.day, a.check_in_at
    from attendance a
    where a.check_in_at is not null
      and a.check_out_at is null
      and a.day < (now() at time zone 'Asia/Kolkata')::date
  loop
    select settings->'attendancePolicy' into pol from organizations where id = r.org_id;
    mode := coalesce(pol->>'autoCheckout', 'off');
    if pol is null or mode = 'off' then
      continue;
    elsif mode = 'hours' then
      hrs := coalesce(nullif(pol->>'autoHours','')::numeric, 8);
      co  := r.check_in_at + make_interval(mins => (hrs * 60)::int);
    else  -- 'time'
      tstr := coalesce(nullif(pol->>'autoTime',''), '20:00');
      co   := ((r.day::text || ' ' || tstr || ':00')::timestamp) at time zone 'Asia/Kolkata';
      if co <= r.check_in_at then
        co := r.check_in_at + interval '8 hours';
      end if;
    end if;
    update attendance
      set check_out_at = co,
          work_seconds = greatest(0, extract(epoch from (co - r.check_in_at))::int)
      where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── Scheduling (run AFTER enabling the pg_cron extension) ────────────────────
-- 1) Dashboard → Database → Extensions → enable "pg_cron".
-- 2) Then run this once (hourly; only ever touches previous-day open rows):
--      select cron.schedule('attendly-auto-checkout', '7 * * * *',
--                           $$select public.auto_checkout_stale();$$);
