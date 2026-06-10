-- Personal information fields for the employee app profile screen.
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists personal_email text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists emergency_contact_name text;
alter table public.profiles add column if not exists emergency_contact_phone text;
