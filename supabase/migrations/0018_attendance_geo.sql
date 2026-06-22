-- Store the check-in coordinates on each attendance row so the admin console
-- can render a map (and an exact pin) for past check-ins, not just the address.
alter table public.attendance add column if not exists lat double precision;
alter table public.attendance add column if not exists lng double precision;
