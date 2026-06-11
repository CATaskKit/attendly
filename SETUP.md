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

## 6. Billing (Stripe per-seat) — optional, for going live
Until you complete this, the app stays on the free **Trial** plan (up to 5
employees) and the Billing tab shows an "connect Stripe" hint instead of failing.

1. **Run the billing migration**: in SQL Editor run `supabase/migrations/0003_billing.sql`.
   It adds the subscription columns to `organizations` and locks them so only the
   Stripe webhook (service_role) can change them — admins can't self-upgrade.
2. **Create the product/price in Stripe** (Dashboard → Products):
   - One product "Attendly", a **recurring** price billed **per unit** (per seat),
     e.g. ₹49/month. Copy the **Price ID** (`price_...`).
3. **Set the Edge Function secrets** (Project → Edge Functions → Secrets, or CLI):
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...        \
                        STRIPE_PRICE_ID=price_...            \
                        STRIPE_WEBHOOK_SECRET=whsec_...      \
                        APP_URL=https://your-app-url
   ```
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
   automatically.) Set `STRIPE_WEBHOOK_SECRET` after step 5.
4. **Deploy the three functions:**
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy billing-portal
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. **Add the webhook** (Stripe → Developers → Webhooks → Add endpoint):
   - URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`. Copy its **Signing secret** (`whsec_...`)
     back into `STRIPE_WEBHOOK_SECRET` (step 3) and redeploy `stripe-webhook`.

Now an owner/HR admin can open **Billing → Upgrade to Growth**, pay per seat in
Stripe Checkout, and the webhook flips the org to **active/unlimited seats**.
**Manage subscription** opens the Stripe customer portal.

## Security notes
- The **anon key is public** and safe in the browser — security comes from RLS.
- Never put the **service_role** key in the frontend; it bypasses RLS. It's only
  for trusted server/Edge Function code (used in later phases).
