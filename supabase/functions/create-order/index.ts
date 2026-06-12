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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { seats: requested = 0 } = await req.json().catch(() => ({}));
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
    if (seats <= 5) return json({ error: 'Up to 5 employees are free — no payment needed' }, 400);

    const amount = rate(seats) * seats * 12 * 100; // paise, billed annually

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `attendly_${Date.now()}`,
        notes: { org_id: profile.org_id, seats: String(seats) },
      }),
    });
    const order = await res.json();
    if (!res.ok) return json({ error: order?.error?.description || 'Could not create the payment order' }, 400);

    await admin.from('organizations').update({ razorpay_order_id: order.id }).eq('id', profile.org_id);
    return json({ orderId: order.id, keyId, amount, currency: 'INR', seats });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'order failed' }, 400);
  }
});
