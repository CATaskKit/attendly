// Edge Function: Stripe webhook → sync subscription state into organizations.
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
// In Stripe → Developers → Webhooks, send: checkout.session.completed,
//   customer.subscription.updated, customer.subscription.deleted
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

async function syncFromSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.org_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const seats = sub.items.data[0]?.quantity ?? null;
  const patch = {
    subscription_status: sub.status,
    plan: sub.status === 'active' ? 'growth' : 'trial',
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    seats,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
  const query = admin.from('organizations').update(patch);
  if (orgId) await query.eq('id', orgId);
  else await query.eq('stripe_customer_id', customerId);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Webhook signature error: ${e instanceof Error ? e.message : e}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          if (!sub.metadata?.org_id && s.client_reference_id) sub.metadata = { ...sub.metadata, org_id: s.client_reference_id };
          await syncFromSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncFromSubscription(event.data.object as Stripe.Subscription);
        break;
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'handler failed' }), { status: 500 });
  }
});
