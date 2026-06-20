-- Workspace branding: a logo shown to employees in the app (display_name already
-- exists on organizations). Logos go in a PUBLIC 'branding' bucket so the <img>
-- can load by URL; only owner/HR can upload to their own org's folder.
alter table organizations add column if not exists logo_url text;

insert into storage.buckets (id, name, public) values ('branding', 'branding', true)
  on conflict (id) do nothing;

drop policy if exists branding_write on storage.objects;
create policy branding_write on storage.objects for all to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = current_org_id()::text and public.is_admin())
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = current_org_id()::text and public.is_admin());
