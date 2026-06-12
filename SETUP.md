# Attendly — backend setup (Supabase)

This turns the app from demo mode into a **live, multi-tenant** product: real
sign-up/sign-in, a Postgres database with tenant isolation, and (next phases)
admin console, realtime, exports and billing.

Until you add Supabase keys, the app keeps working in **demo mode** (the login's
"Continue in demo mode" button), so deploys never break.

## 1. Create a Supabase project
1. Go to https://supabase.com → **New project** (pick a region near your users).
2. Wait for it to provision, then open **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

## 2. Create the database
Open **SQL Editor -> New query** and run the SQL files in `supabase/migrations/` in order. This creates the tables, roles, Row-Level Security policies, auth trigger, profile fields, and live-flow indexes/constraints.

> Prefer the CLI? `supabase link --project-ref <ref>` then `supabase db push`.

## 3. Auth settings
**Authentication → Providers → Email**: for quick testing, turn **"Confirm email"
OFF** (so sign-up signs you in immediately and can create the org). Turn it back
on for production and add your SMTP/branding.

## 4. Configure the app
**Local:**
```bash
cp .env.example .env       # then fill in the two values
npm install
npm run dev
```

**Vercel:** Project → **Settings → Environment Variables** → add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production + Preview), then
redeploy.

## 5. Try it
- Open the app → **Create a workspace** → name, email, password.
  This signs you up, runs `create_organization`, and makes you the **Owner**.
- Sign out / back in to confirm real auth.

## What's wired
- Multi-tenant schema + RLS (every row scoped to `org_id`; role enum owner/hr/manager/employee).
- Real email/password auth, session persistence, password reset, and protected routes.
- Owner sign-up that provisions the organization and opens onboarding.
- Admin dashboard, employees, approvals, holidays, reports/export, and onboarding are backed by Supabase.
- Employee check-in/out, attendance history, leave requests, leave balances, profile details, holidays, and manager approvals are backed by Supabase.
- Realtime updates for attendance/approvals, an in-app notification center, server-side `.xlsx` exports via an Edge Function, and Stripe per-seat billing with plan/seat gating.

## 6. Billing (Razorpay, annual per-seat) — optional, for going live
**Every org gets a 1-year period the moment it onboards.** Up to **5 employees is
free** for that whole year and renews free. Above 5 it's paid (per employee /
month, **billed annually**): 6–10 **₹25** · 11–50 **₹20** · 51–100 **₹18** ·
101+ **₹15**. Raising the seat cap mid-year charges **only the additional cost,
prorated** for the days left in the period (the period end stays put); a fresh
year is charged only at renewal. Until you complete this, every org stays on the
free 5-seat plan and the Billing tab shows a "connect Razorpay" hint.

1. **Run the billing migrations**: in SQL Editor run
   `supabase/migrations/0003_billing.sql`, then `0004_razorpay.sql`, then
   `0005_billing_period.sql`. They add the subscription/payment-history tables,
   give every org a 1-year period at onboarding, and lock the billing columns so
   only the Edge Functions (service_role) can change them — admins can't
   self-upgrade by editing the database.
2. **Get your Razorpay keys** (Dashboard → Account & Settings → API Keys →
   Generate key). Start with **Test mode** keys (`rzp_test_...`) and switch to
   live keys when you're ready to charge real money.
3. **Set the Edge Function secrets** (Project → Edge Functions → Secrets, or CLI):
   ```bash
   supabase secrets set RAZORPAY_KEY_ID=rzp_test_...      \
                        RAZORPAY_KEY_SECRET=...           \
                        RAZORPAY_WEBHOOK_SECRET=<pick-a-long-random-string>
   ```
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
   automatically. Unlike Stripe, *you choose* the webhook secret — use the same
   string in step 5.)
4. **Deploy the three functions:**
   ```bash
   supabase functions deploy create-order
   supabase functions deploy verify-payment
   supabase functions deploy razorpay-webhook --no-verify-jwt
   ```
5. **Add the webhook** (Razorpay Dashboard → Account & Settings → Webhooks → Add):
   - URL: `https://<project-ref>.functions.supabase.co/razorpay-webhook`
   - Secret: the same `RAZORPAY_WEBHOOK_SECRET` from step 3
   - Active events: **`order.paid`**

Now an owner/HR admin opens **Billing**, picks a seat count, and pays via
Razorpay Checkout (UPI / cards / netbanking) without leaving the app. The
payment is verified server-side (`verify-payment`) and the org is activated for
**1 year** at that seat count; the webhook is a backup sync in case the tab
closes mid-payment. The server always recomputes the price from the tier table —
clients can't tamper with amounts.

## Security notes
- The **anon key is public** and safe in the browser — security comes from RLS.
- Never put the **service_role** key in the frontend; it bypasses RLS. It's only
  for trusted server/Edge Function code (used in later phases).
