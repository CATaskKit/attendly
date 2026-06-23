-- Store the check-OUT location separately from the check-in location, so an
-- attendance row keeps both where the employee clocked in and where they clocked
-- out. (check_in location lives in the existing location/lat/lng columns.)
alter table public.attendance add column if not exists checkout_location text;
alter table public.attendance add column if not exists checkout_lat double precision;
alter table public.attendance add column if not exists checkout_lng double precision;
