import { supabase, isSupabaseConfigured } from './supabase';
import { APP_NAME } from './brand';

// ── Plans & tier pricing (INR per employee/month, billed annually) ────
// Keep this table in sync with supabase/functions/create-order (the server
// recomputes the price — the client never sets the amount).
export const TIERS = [
  { upTo: 5, rate: 0, label: '1 – 5' },
  { upTo: 10, rate: 25, label: '6 – 10' },
  { upTo: 50, rate: 20, label: '11 – 50' },
  { upTo: 100, rate: 18, label: '51 – 100' },
  { upTo: Infinity, rate: 15, label: '101+' },
] as const;

export const PLANS = {
  trial: { key: 'trial', name: 'Free Trial', seatLimit: 5 },
  growth: { key: 'growth', name: 'Growth', seatLimit: Infinity },
} as const;

/** Monthly per-employee rate for a team of `seats`. */
export function rateFor(seats: number): number {
  for (const t of TIERS) if (seats <= t.upTo) return t.rate;
  return TIERS[TIERS.length - 1].rate;
}
/** Annual price in INR for `seats` employees (rate × seats × 12). */
export function annualTotal(seats: number): number {
  return rateFor(seats) * seats * 12;
}
export const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export type OrgBilling = {
  id: string;
  name: string;
  plan: string;
  subscription_status: string;
  seats: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

/** Paid and not past the end of the annual period. */
export function isActive(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end'>): boolean {
  if (b.subscription_status !== 'active') return false;
  return !b.current_period_end || new Date(b.current_period_end).getTime() > Date.now();
}
export function planFor(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end'>) {
  return isActive(b) ? PLANS.growth : PLANS.trial;
}
/** Trial caps at 5; an active org is capped at the seats it paid for. */
export function seatLimit(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats'>): number {
  return isActive(b) ? (b.seats ?? Infinity) : PLANS.trial.seatLimit;
}
export function trialDaysLeft(b: Pick<OrgBilling, 'trial_ends_at'>): number {
  if (!b.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(b.trial_ends_at).getTime() - Date.now()) / 86400000));
}
/** true when adding one more employee would exceed the current plan's seats. */
export function atSeatLimit(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats'>, seatsUsed: number): boolean {
  return seatsUsed >= seatLimit(b);
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function fetchBilling(orgId: string): Promise<OrgBilling | null> {
  if (!isSupabaseConfigured) {
    // Demo mode: a healthy trial org so the Billing tab still renders.
    return { id: orgId, name: 'Demo workspace', plan: 'trial', subscription_status: 'trialing', seats: null, trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(), current_period_end: null };
  }
  const { data, error } = await db().from('organizations')
    .select('id,name,plan,subscription_status,seats,trial_ends_at,current_period_end')
    .eq('id', orgId).single();
  if (error) throw error;
  return (data as OrgBilling) ?? null;
}

export type PaymentRow = { id: string; amount_inr: number; seats: number; period_end: string; created_at: string };

export async function listPayments(orgId: string): Promise<PaymentRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await db().from('billing_payments')
    .select('id,amount_inr,seats,period_end,created_at')
    .eq('org_id', orgId).order('created_at', { ascending: false }).limit(24);
  if (error) throw error;
  return (data as PaymentRow[]) ?? [];
}

// ── Razorpay Checkout ─────────────────────────────────────────────────
async function invokeFn<T>(name: string, body?: unknown): Promise<T> {
  const s = db();
  const { data: { session } } = await s.auth.getSession();
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error('Billing is not connected yet — deploy the Razorpay functions (SETUP.md §6)');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `${name} failed`);
  return json as T;
}

type RzpHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpInstance = {
  open: () => void;
  on: (event: 'payment.failed', cb: (resp: { error?: { description?: string } }) => void) => void;
};
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RzpInstance }
}

let rzpLoader: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!rzpLoader) {
    rzpLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve();
      s.onerror = () => { rzpLoader = null; reject(new Error('Could not load Razorpay — check your connection')); };
      document.head.appendChild(s);
    });
  }
  return rzpLoader;
}

/**
 * Buy `seats` seats for one year: the server prices the order (tier table),
 * Razorpay Checkout opens in-app (UPI/cards/netbanking), and on success the
 * payment is verified server-side which activates the org.
 */
export async function startCheckout(seats: number): Promise<void> {
  const order = await invokeFn<{ orderId: string; keyId: string; amount: number; currency: string; seats: number }>('create-order', { seats });
  await loadRazorpay();
  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: APP_NAME,
      description: `${order.seats} seats · 1 year`,
      theme: { color: '#4f46e5' },
      modal: { ondismiss: () => reject(new Error('Payment canceled')) },
      handler: (resp: RzpHandlerResponse) => {
        invokeFn('verify-payment', resp).then(() => resolve()).catch(reject);
      },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
    rzp.open();
  });
}
