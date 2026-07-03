// Edge Function: verify a Razorpay payment signature and activate the org.
// Deploy:  supabase functions deploy verify-payment
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Called by the app right after Razorpay Checkout succeeds. The signature is
// HMAC-SHA256(order_id|payment_id, key_secret); we also re-fetch the order and
// payment from Razorpay to confirm capture and org ownership.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildInvoicePdf, type InvoiceDoc } from '../_shared/invoice-pdf.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Supplier (us). State code 27 = Maharashtra; a customer in Maharashtra is
// charged CGST+SGST, everyone else IGST. Mirror of src/lib/billing.ts SUPPLIER.
const SUPPLIER = {
  name: 'CATaskKit',
  gstin: '27FLWPS2525A1ZT',
  address: 'Opp. to Lotus Court, Kharadi, Pune, Maharashtra, India – 411001',
  state: 'Maharashtra',
  email: 'info@cataskkit.com',
  phone: '+91 70282 79090',
  sac: '997331',
};

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json({ error: 'Missing payment details' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { data: profile } = await userClient.from('profiles').select('org_id, role').eq('id', user.id).single();
    if (!profile?.org_id || !['owner', 'hr'].includes(profile.role)) return json({ error: 'Only an owner or HR admin can manage billing' }, 403);

    const expected = await hmacHex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) return json({ error: 'Payment signature mismatch' }, 400);

    // Confirm with Razorpay: order belongs to this org, payment is captured.
    const auth = { Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`) };
    const order = await (await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, { headers: auth })).json();
    if (order?.notes?.org_id !== profile.org_id) return json({ error: 'This payment does not belong to your organization' }, 403);
    const payment = await (await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, { headers: auth })).json();
    if (payment?.order_id !== razorpay_order_id || !['captured', 'authorized'].includes(payment?.status)) {
      return json({ error: 'Payment is not captured yet' }, 400);
    }

    const seats = parseInt(order?.notes?.seats ?? '0', 10) || null;
    const reimbursement = order?.notes?.reimbursement === 'true';
    const paidSeats = (seats ?? 0) > 5; // ≤5 stays free-tier even with the add-on
    // create-order decided the period end (kept for an upgrade, extended a year
    // for a renewal); fall back to a fresh year if an older order lacks it.
    const periodEnd = order?.notes?.period_end ?? new Date(Date.now() + 365 * 86400000).toISOString();

    const admin = createClient(url, service);
    await admin.from('billing_payments').upsert({
      org_id: profile.org_id,
      provider: 'razorpay',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      amount_inr: (order?.amount ?? 0) / 100,
      seats: seats ?? 0,
      period_end: periodEnd,
    }, { onConflict: 'payment_id', ignoreDuplicates: true });

    await admin.from('organizations').update({
      plan: paidSeats ? 'growth' : 'free',
      subscription_status: paidSeats ? 'active' : 'free',
      seats,
      reimbursement_enabled: reimbursement,
      razorpay_order_id,
      razorpay_payment_id,
      current_period_end: periodEnd,
    }).eq('id', profile.org_id);

    // ── GST tax invoice ────────────────────────────────────────────────
    // Generate once per payment (idempotent) and, if configured, email it.
    // A failure here must NOT fail verification — the payment already went
    // through and the org is activated above.
    let invoiceNo: string | null = null;
    try {
      const { data: existing } = await admin.from('invoices').select('id').eq('payment_id', razorpay_payment_id).maybeSingle();
      if (!existing) {
        const totalInr = (order?.amount ?? 0) / 100;
        const taxable = Number(order?.notes?.subtotal_inr) || Math.round(totalInr / 1.18);
        const gst = Number(order?.notes?.gst_inr) || (totalInr - taxable);
        const { data: org } = await admin.from('organizations')
          .select('name, legal_name, gstin, billing_state, billing_address, billing_pincode').eq('id', profile.org_id).single();
        const customerState = (org?.billing_state ?? '').trim();
        const intraState = customerState.toLowerCase() === SUPPLIER.state.toLowerCase();
        const cgst = intraState ? Math.round(gst / 2) : 0;
        const sgst = intraState ? gst - cgst : 0;
        const igst = intraState ? 0 : gst;
        const custAddress = [org?.billing_address, org?.billing_pincode, customerState].filter(Boolean).join(', ') || null;

        const { data: no } = await admin.rpc('allocate_invoice_no', { inv_date: new Date().toISOString() });
        invoiceNo = no as string;

        await admin.from('invoices').insert({
          org_id: profile.org_id,
          payment_id: razorpay_payment_id,
          invoice_no: invoiceNo,
          supplier_name: SUPPLIER.name,
          supplier_gstin: SUPPLIER.gstin,
          supplier_address: SUPPLIER.address,
          supplier_state: SUPPLIER.state,
          customer_name: org?.legal_name || org?.name || 'Customer',
          customer_gstin: org?.gstin ?? null,
          customer_state: customerState || null,
          customer_address: custAddress,
          sac_code: SUPPLIER.sac,
          taxable_value: taxable,
          cgst, sgst, igst,
          total: taxable + gst,
          place_of_supply: customerState || null,
        });

        // Auto-email the PDF (Resend). Skipped silently if the key isn't set;
        // the invoice is always downloadable from Billing regardless.
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey && user.email) {
          try {
            const till = new Date(periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const doc: InvoiceDoc = {
              invoice_no: invoiceNo,
              invoice_date: new Date().toISOString(),
              supplier: { name: SUPPLIER.name, gstin: SUPPLIER.gstin, address: SUPPLIER.address, state: SUPPLIER.state, email: SUPPLIER.email, phone: SUPPLIER.phone },
              customer: { name: org?.legal_name || org?.name || 'Customer', gstin: org?.gstin, state: customerState, address: custAddress },
              sac_code: SUPPLIER.sac,
              description: `Attendly — annual subscription (${seats ?? 0} seats) · valid till ${till}`,
              taxable_value: taxable, cgst, sgst, igst, total: taxable + gst,
              place_of_supply: customerState || null,
            };
            const pdf = await buildInvoicePdf(doc);
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: `${SUPPLIER.name} <${SUPPLIER.email}>`,
                to: [user.email],
                subject: `Your ${SUPPLIER.name} tax invoice ${invoiceNo}`,
                html: `<p>Hi,</p><p>Thank you for your payment. Your GST tax invoice <b>${invoiceNo}</b> is attached as a PDF.</p><p>You can also download it anytime from Billing in your admin console.</p><p>— ${SUPPLIER.name}</p>`,
                attachments: [{ filename: `${invoiceNo.replace(/\//g, '-')}.pdf`, content: toBase64(pdf) }],
              }),
            });
          } catch (mailErr) {
            console.error('invoice email failed', mailErr);
          }
        }
      } else {
        invoiceNo = null;
      }
    } catch (invErr) {
      console.error('invoice generation failed', invErr);
    }

    return json({ ok: true, seats, reimbursement, current_period_end: periodEnd, invoice_no: invoiceNo });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'verification failed' }, 400);
  }
});
