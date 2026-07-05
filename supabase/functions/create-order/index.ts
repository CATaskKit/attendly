// Edge Function: create a Razorpay Order for an annual, tiered per-seat purchase.
// Deploy:  supabase functions deploy create-order
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// The price is computed HERE from the tier table — the client never sets it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Keep in sync with src/lib/billing.ts TIERS.
const rate = (seats: number) => (seats <= 5 ? 0 : seats <= 10 ? 25 : seats <= 50 ? 20 : seats <= 100 ? 18 : 15);
const annual = (seats: number) => rate(seats) * seats * 12;
const REIMBURSEMENT_RATE = 5; // ₹/employee/month add-on; keep in sync with billing.ts
const addonAnnual = (seats: number) => REIMBURSEMENT_RATE * seats * 12;
const YEAR_MS = 365 * 86400000;
const GST_RATE = 0.18; // 18% GST added on top of every charge; keep in sync with billing.ts

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { seats: requested = 0, reimbursement = false } = await req.json().catch(() => ({}));
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) return json({ error: 'Billing is not configured yet (Razorpay keys missing)' }, 400);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { data: profile } = await userClient.from('profiles').select('org_id, role').eq('id', user.id).single();
    if (!profile?.org_id || !['owner', 'hr'].includes(profile.role)) return json({ error: 'Only an owner or HR admin can manage billing' }, 403);

    // Seats must cover the people already on the roster.
    const admin = createClient(url, service);
    const { count } = await admin.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id);
    const seats = Math.max(Math.floor(Number(requested)) || 0, count ?? 0);

    // Price against the org's open 1-year period: inside it we charge only the
    // additional cost — the seat delta plus, if newly enabling the reimbursement
    // add-on, ₹5×seats×12 — prorated for the days left, keeping the same period
    // end; once lapsed it's a fresh full year. Add-on alone is fine for ≤5 seats.
    const { data: org } = await admin.from('organizations').select('subscription_status, seats, current_period_end, reimbursement_enabled').eq('id', profile.org_id).single();
    const now = Date.now();
    const periodEndMs = org?.current_period_end ? new Date(org.current_period_end).getTime() : 0;
    const valid = periodEndMs > now;
    const renewal = !valid;
    const paidSeats = org?.subscription_status === 'active' && valid ? (org.seats ?? 0) : 0;
    const fraction = valid ? Math.min(1, Math.max(0, (periodEndMs - now) / YEAR_MS)) : 1;
    const alreadyReimb = org?.reimbursement_enabled === true && valid;
    const wantReimb = Boolean(reimbursement) || alreadyReimb;
    // Reimbursement is free for ≤5-employee orgs; only >5 pays ₹5×seats×12.
    const addonRate = seats > 5 ? addonAnnual(seats) : 0;

    const seatYr = valid ? annual(seats) - annual(paidSeats) : annual(seats);
    const addonYr = valid ? (wantReimb && !alreadyReimb ? addonRate : 0) : (wantReimb ? addonRate : 0);
    const amountInr = Math.max(0, Math.round((seatYr + addonYr) * fraction)); // pre-GST subtotal
    if (amountInr <= 0) {
      return json({ error: seats <= 5 ? 'Up to 5 employees are free — reimbursement is included, no payment needed' : 'No additional charge needed' }, 400);
    }
    // Business is GST-registered — add 18% GST on top of the subtotal.
    const gstInr = Math.round(amountInr * GST_RATE);
    const totalInr = amountInr + gstInr;
    const amount = totalInr * 100; // paise, GST-inclusive
    const newPeriodEnd = (valid ? new Date(periodEndMs) : new Date(now + YEAR_MS)).toISOString();

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `ehajri_${Date.now()}`,
        notes: { org_id: profile.org_id, seats: String(seats), period_end: newPeriodEnd, reimbursement: String(wantReimb), subtotal_inr: String(amountInr), gst_inr: String(gstInr), gst_rate: '0.18' },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description || 'Could not create the payment order' }, 400);

    await admin.from('organizations').update({ razorpay_order_id: order.id }).eq('id', profile.org_id);
    return json({ orderId: order.id, keyId, amount, currency: 'INR', seats, renewal });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'order failed' }, 400);
  }
});
