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

## Next phases (roadmap)
- Supabase Realtime for live attendance/approvals + a notification center.
- Server-side large `.xlsx` exports via an Edge Function + Storage.
- Stripe per-seat billing, plan gating, and production hardening.

## Security notes
- The **anon key is public** and safe in the browser — security comes from RLS.
- Never put the **service_role** key in the frontend; it bypasses RLS. It's only
  for trusted server/Edge Function code (used in later phases).
