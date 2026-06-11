// Edge Function: create a Stripe Checkout Session for a per-seat subscription.
// Deploy:  supabase functions deploy create-checkout
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, APP_URL, SUPABASE_SERVICE_ROLE_KEY
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { quantity = 1 } = await req.json().catch(() => ({}));
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = Deno.env.get('APP_URL') ?? new URL(req.url).origin;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { data: profile } = await userClient.from('profiles').select('org_id, role').eq('id', user.id).single();
    if (!profile?.org_id || !['owner', 'hr'].includes(profile.role)) return json({ error: 'Only an owner or HR admin can manage billing' }, 403);

    const admin = createClient(url, service);
    const { data: org } = await admin.from('organizations').select('*').eq('id', profile.org_id).single();
    if (!org) return json({ error: 'Organization not found' }, 404);

    let customerId: string = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org.name, email: user.email ?? undefined, metadata: { org_id: org.id } });
      customerId = customer.id;
      await admin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: Math.max(1, Number(quantity) || 1) }],
      client_reference_id: org.id,
      subscription_data: { metadata: { org_id: org.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl}/#/admin?billing=success`,
      cancel_url: `${appUrl}/#/admin?billing=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'checkout failed' }, 400);
  }
});
