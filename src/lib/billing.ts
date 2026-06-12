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

// Every org gets a 1-year period from onboarding. Up to 5 employees is free for
// that whole year (and renews free). Above 5, the org pays the tier matrix —
// prorated to fit inside their existing period; a fresh year only at renewal.
export const FREE_SEAT_LIMIT = 5;
export const PERIOD_DAYS = 365;
const YEAR_MS = PERIOD_DAYS * 86400000;

// Optional paid add-on: Reimbursement / convenience claims, ₹/employee/month.
export const REIMBURSEMENT_RATE = 5;
/** Annual add-on price in INR for `seats` employees (₹5 × seats × 12). */
export function addonAnnual(seats: number): number {
  return REIMBURSEMENT_RATE * seats * 12;
}

export const PLANS = {
  free: { key: 'free', name: 'Free (up to 5)', seatLimit: FREE_SEAT_LIMIT },
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
  reimbursement_enabled: boolean;
  reimbursement_require_manager: boolean;
};

/** The org's 1-year period is still open (free or paid). */
export function periodValid(b: Pick<OrgBilling, 'current_period_end'>): boolean {
  return !!b.current_period_end && new Date(b.current_period_end).getTime() > Date.now();
}
/** Paying customer (>5 seats) with an open period. */
export function isPaid(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end'>): boolean {
  return b.subscription_status === 'active' && periodValid(b);
}
/** Back-compat alias used around the app: "active" === has an open period. */
export function isActive(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end'>): boolean {
  return isPaid(b);
}
export function planFor(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end'>) {
  return isPaid(b) ? PLANS.growth : PLANS.free;
}
/** Seats the org has paid for and that are still inside the period. */
export function currentPaidSeats(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats'>): number {
  return isPaid(b) ? (b.seats ?? 0) : 0;
}
/** Free orgs cap at 5; a paid org is capped at the seats it bought. */
export function seatLimit(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats'>): number {
  return isPaid(b) ? (b.seats ?? Infinity) : FREE_SEAT_LIMIT;
}
/** Whole days left in the current 1-year period. */
export function periodDaysLeft(b: Pick<OrgBilling, 'current_period_end'>): number {
  if (!b.current_period_end) return 0;
  return Math.max(0, Math.ceil((new Date(b.current_period_end).getTime() - Date.now()) / 86400000));
}
/** Fraction (0–1) of a year still remaining — used to prorate upgrades. */
export function periodFraction(b: Pick<OrgBilling, 'current_period_end'>): number {
  if (!periodValid(b)) return 1;
  const ms = new Date(b.current_period_end!).getTime() - Date.now();
  return Math.min(1, Math.max(0, ms / YEAR_MS));
}
/** true when adding one more employee would exceed the current plan's seats. */
export function atSeatLimit(b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats'>, seatsUsed: number): boolean {
  return seatsUsed >= seatLimit(b);
}

/** Reimbursement add-on is paid for and inside an open period. */
export function reimbursementActive(b: Pick<OrgBilling, 'reimbursement_enabled' | 'current_period_end'>): boolean {
  return !!b.reimbursement_enabled && periodValid(b);
}

export type Quote = { amount: number; addonAmount: number; prorated: boolean; renewal: boolean; periodEnd: Date; annualAtRenewal: number };
/**
 * What it costs *right now* to run `newSeats` employees (and optionally enable
 * the reimbursement add-on). Inside an open period we charge only the additional
 * cost — the seat delta plus, if newly enabling reimbursement, ₹5×seats×12 —
 * prorated for the days left, keeping the same period end. Once the period has
 * lapsed it's a full fresh year. Mirror of the server in create-order.
 */
export function quoteFor(
  b: Pick<OrgBilling, 'subscription_status' | 'current_period_end' | 'seats' | 'reimbursement_enabled'>,
  newSeats: number,
  reimbursement?: boolean,
): Quote {
  const valid = periodValid(b);
  const frac = valid ? periodFraction(b) : 1;
  const alreadyReimb = reimbursementActive(b);
  const wantReimb = reimbursement ?? alreadyReimb;

  const seatYr = valid ? annualTotal(newSeats) - annualTotal(currentPaidSeats(b)) : annualTotal(newSeats);
  const addonYr = valid
    ? (wantReimb && !alreadyReimb ? addonAnnual(newSeats) : 0) // enabling within the period
    : (wantReimb ? addonAnnual(newSeats) : 0);                  // fresh year includes it if wanted

  return {
    amount: Math.max(0, Math.round((seatYr + addonYr) * frac)),
    addonAmount: Math.max(0, Math.round(addonYr * frac)),
    prorated: valid && frac < 1,
    renewal: !valid,
    periodEnd: valid ? new Date(b.current_period_end!) : new Date(Date.now() + YEAR_MS),
    annualAtRenewal: annualTotal(newSeats) + (wantReimb ? addonAnnual(newSeats) : 0),
  };
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export async function fetchBilling(orgId: string): Promise<OrgBilling | null> {
  if (!isSupabaseConfigured) {
    // Demo mode: a free org with a fresh 1-year period so Billing renders.
    const periodEnd = new Date(Date.now() + YEAR_MS).toISOString();
    return { id: orgId, name: 'Demo workspace', plan: 'free', subscription_status: 'free', seats: null, trial_ends_at: periodEnd, current_period_end: periodEnd, reimbursement_enabled: false, reimbursement_require_manager: true };
  }
  const full = await db().from('organizations')
    .select('id,name,plan,subscription_status,seats,trial_ends_at,current_period_end,reimbursement_enabled,reimbursement_require_manager')
    .eq('id', orgId).single();
  if (!full.error) return (full.data as OrgBilling) ?? null;

  // Reimbursement columns land in migration 0006 — until it's run, fall back to
  // the base billing columns so the Billing page keeps working.
  const base = await db().from('organizations')
    .select('id,name,plan,subscription_status,seats,trial_ends_at,current_period_end')
    .eq('id', orgId).single();
  if (base.error) throw base.error;
  return base.data ? { ...(base.data as Omit<OrgBilling, 'reimbursement_enabled' | 'reimbursement_require_manager'>), reimbursement_enabled: false, reimbursement_require_manager: true } : null;
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
 * Buy/raise the seat cap to `seats`: the server prices the order (tier matrix,
 * prorated to the open period), Razorpay Checkout opens in-app (UPI/cards/
 * netbanking), and on success the payment is verified server-side which raises
 * the org's seat cap (and, on renewal, extends the period by a year).
 */
export async function startCheckout(seats: number, reimbursement = false): Promise<void> {
  const order = await invokeFn<{ orderId: string; keyId: string; amount: number; currency: string; seats: number; renewal: boolean }>('create-order', { seats, reimbursement });
  await loadRazorpay();
  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: APP_NAME,
      description: order.renewal ? `${order.seats} seats · 1 year` : `${order.seats} seats · prorated to period end`,
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
