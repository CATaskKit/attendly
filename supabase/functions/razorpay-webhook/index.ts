// Edge Function: Razorpay webhook (backup sync — covers tab-closed payments).
// Deploy:  supabase functions deploy razorpay-webhook --no-verify-jwt
// Secrets: RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// In Razorpay → Account & Settings → Webhooks, subscribe to: order.paid
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;
  if ((await hmacHex(secret, body)) !== signature) {
    return new Response('Webhook signature mismatch', { status: 400 });
  }

  try {
    const event = JSON.parse(body);
    if (event.event !== 'order.paid') {
      return new Response(JSON.stringify({ received: true, ignored: event.event }), { headers: { 'Content-Type': 'application/json' } });
    }

    const order = event.payload?.order?.entity;
    const payment = event.payload?.payment?.entity;
    const orgId = order?.notes?.org_id;
    const seats = parseInt(order?.notes?.seats ?? '0', 10) || null;
    if (!orgId || !payment?.id) return new Response(JSON.stringify({ received: true, skipped: 'missing org/payment' }), { headers: { 'Content-Type': 'application/json' } });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Idempotent: if verify-payment already recorded this payment, do nothing
    // (a replayed webhook must not extend the period again).
    const { data: existing } = await admin.from('billing_payments').select('id').eq('payment_id', payment.id).maybeSingle();
    if (existing) return new Response(JSON.stringify({ received: true, duplicate: true }), { headers: { 'Content-Type': 'application/json' } });

    const periodEnd = order?.notes?.period_end ?? new Date(Date.now() + 365 * 86400000).toISOString();
    await admin.from('billing_payments').insert({
      org_id: orgId,
      provider: 'razorpay',
      order_id: order.id,
      payment_id: payment.id,
      amount_inr: (order?.amount ?? 0) / 100,
      seats: seats ?? 0,
      period_end: periodEnd,
    });
    await admin.from('organizations').update({
      plan: 'growth',
      subscription_status: 'active',
      seats,
      razorpay_order_id: order.id,
      razorpay_payment_id: payment.id,
      current_period_end: periodEnd,
    }).eq('id', orgId);

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'handler failed' }), { status: 500 });
  }
});
