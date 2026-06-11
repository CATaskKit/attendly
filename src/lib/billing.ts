import { supabase } from './supabase';

// ── Plan definitions ──────────────────────────────────────────────────
// The free Trial caps active employees; Growth is per-seat (priced in Stripe).
export const PLANS = {
  trial: { key: 'trial', name: 'Trial', seatLimit: 5 },
  growth: { key: 'growth', name: 'Growth', seatLimit: Infinity },
} as const;

export const PRICE_PER_SEAT_LABEL = '₹49 / seat / month';

export type OrgBilling = {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  seats: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

export function isActive(b: Pick<OrgBilling, 'subscription_status'>): boolean {
  return b.subscription_status === 'active';
}
export function planFor(b: Pick<OrgBilling, 'subscription_status'>) {
  return isActive(b) ? PLANS.growth : PLANS.trial;
}
export function seatLimit(b: Pick<OrgBilling, 'subscription_status'>): number {
  return planFor(b).seatLimit;
}
export function trialDaysLeft(b: Pick<OrgBilling, 'trial_ends_at'>): number {
  if (!b.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(b.trial_ends_at).getTime() - Date.now()) / 86400000));
}
/** true when adding one more employee would exceed the current plan's seats. */
export function atSeatLimit(b: Pick<OrgBilling, 'subscription_status'>, seatsUsed: number): boolean {
  return seatsUsed >= seatLimit(b);
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function fetchBilling(orgId: string): Promise<OrgBilling | null> {
  const { data, error } = await db().from('organizations')
    .select('id,name,plan,subscription_status,stripe_customer_id,seats,trial_ends_at,current_period_end')
    .eq('id', orgId).single();
  if (error) throw error;
  return (data as OrgBilling) ?? null;
}

// ── Stripe Edge Function calls ────────────────────────────────────────
async function invokeFn<T>(name: string, body?: unknown): Promise<T> {
  const s = db();
  const { data: { session } } = await s.auth.getSession();
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token}`, apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `${name} failed`);
  return json as T;
}

/** Start a Stripe Checkout for `quantity` seats; redirects to Stripe. */
export async function startCheckout(quantity: number): Promise<void> {
  const { url } = await invokeFn<{ url: string }>('create-checkout', { quantity });
  window.location.href = url;
}

/** Open the Stripe customer billing portal; redirects to Stripe. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await invokeFn<{ url: string }>('billing-portal');
  window.location.href = url;
}
