-- Let employees withdraw a still-pending reimbursement. leave_status already has
-- 'Cancelled'; reimb_status needs it. (ALTER TYPE ADD VALUE runs standalone.)
alter type reimb_status add value if not exists 'Cancelled';
