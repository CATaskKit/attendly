// Shared, idempotent invoice creation. Used by verify-payment (on a new
// payment) and invoice-pdf (backfill: generate on first download for any past
// payment). One invoice per payment_id — safe to call repeatedly.

// The supplier (us). State code 27 = Maharashtra → intra-state customers get
// CGST+SGST, everyone else IGST. Mirror of src/lib/billing.ts SUPPLIER.
export const SUPPLIER = {
  name: 'CATaskKit',
  gstin: '27FLWPS2525A1ZT',
  address: 'Opp. to Lotus Court, Kharadi, Pune, Maharashtra, India – 411001',
  state: 'Maharashtra',
  email: 'info@cataskkit.com',
  phone: '+91 70282 79090',
  sac: '997331',
};

// Service-role client — typed loosely to avoid supabase-js generic friction
// when passed across Edge Function boundaries.
// deno-lint-ignore no-explicit-any
type Admin = any;

/**
 * Return the invoice for `paymentId`, creating it if missing. `opts` lets the
 * caller pass the exact pre-GST subtotal/tax (from the Razorpay order notes);
 * for backfill we derive them from the recorded GST-inclusive total.
 * Returns null if the payment doesn't exist for this org.
 */
export async function ensureInvoiceForPayment(
  admin: Admin,
  orgId: string,
  paymentId: string,
  opts?: { taxable?: number; gst?: number },
// deno-lint-ignore no-explicit-any
): Promise<any | null> {
  const { data: existing, error: exErr } = await admin.from('invoices').select('*').eq('payment_id', paymentId).maybeSingle();
  if (exErr) throw new Error(`invoices lookup failed: ${exErr.message}`);
  if (existing) return existing;

  const { data: pay, error: payErr } = await admin.from('billing_payments').select('amount_inr').eq('payment_id', paymentId).eq('org_id', orgId).maybeSingle();
  if (payErr) throw new Error(`payment lookup failed: ${payErr.message}`);
  if (!pay) return null;

  const total = Number(pay.amount_inr);
  const taxable = opts?.taxable ?? Math.round(total / 1.18);
  const gst = opts?.gst ?? (total - taxable);

  const { data: org } = await admin.from('organizations')
    .select('name, legal_name, gstin, billing_state, billing_address, billing_pincode').eq('id', orgId).single();
  const customerState = (org?.billing_state ?? '').trim();
  const intra = customerState.toLowerCase() === SUPPLIER.state.toLowerCase();
  const cgst = intra ? Math.round(gst / 2) : 0;
  const sgst = intra ? gst - cgst : 0;
  const igst = intra ? 0 : gst;
  const customer_address = [org?.billing_address, org?.billing_pincode, customerState].filter(Boolean).join(', ') || null;

  const { data: no, error: noErr } = await admin.rpc('allocate_invoice_no', { inv_date: new Date().toISOString() });
  if (noErr || !no) throw new Error(`invoice numbering failed: ${noErr?.message ?? 'no number returned (is migration 0024 applied & schema cache reloaded?)'}`);
  const row = {
    org_id: orgId,
    payment_id: paymentId,
    invoice_no: no as string,
    supplier_name: SUPPLIER.name,
    supplier_gstin: SUPPLIER.gstin,
    supplier_address: SUPPLIER.address,
    supplier_state: SUPPLIER.state,
    customer_name: org?.legal_name || org?.name || 'Customer',
    customer_gstin: org?.gstin ?? null,
    customer_state: customerState || null,
    customer_address,
    sac_code: SUPPLIER.sac,
    taxable_value: taxable,
    cgst, sgst, igst,
    total: taxable + gst,
    place_of_supply: customerState || null,
  };

  const { data: inserted, error } = await admin.from('invoices').insert(row).select('*').single();
  if (error) {
    // Race: another request inserted first (payment_id is unique). Return that.
    const { data: again } = await admin.from('invoices').select('*').eq('payment_id', paymentId).maybeSingle();
    if (again) return again;
    throw new Error(`invoice insert failed: ${error.message}`);
  }
  return inserted;
}
