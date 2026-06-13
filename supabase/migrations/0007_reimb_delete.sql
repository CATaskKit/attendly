-- Let owner/HR void (hard-delete) a reimbursement claim — e.g. duplicates or
-- erroneous submissions. Managers and employees can't delete; "Reject" remains
-- the soft path that keeps the record. Run after 0006_reimbursements.sql.

drop policy if exists reimb_delete on reimbursements;
create policy reimb_delete on reimbursements for delete
  using (org_id = current_org_id() and is_admin());

-- Allow admins to remove the claim's receipts from storage too, so deleting a
-- claim doesn't orphan files in the private `receipts` bucket.
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = current_org_id()::text and public.is_admin());
