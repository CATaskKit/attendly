// Edge Function: verify a Razorpay payment signature and activate the org.
// Deploy:  supabase functions deploy verify-payment
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Called by the app right after Razorpay Checkout succeeds. The signature is
// HMAC-SHA256(order_id|payment_id, key_secret); we also re-fetch the order and
// payment from Razorpay to confirm capture and org ownership.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString();

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
      plan: 'growth',
      subscription_status: 'active',
      seats,
      razorpay_order_id,
      razorpay_payment_id,
      current_period_end: periodEnd,
    }).eq('id', profile.org_id);

    return json({ ok: true, seats, current_period_end: periodEnd });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'verification failed' }, 400);
  }
});
