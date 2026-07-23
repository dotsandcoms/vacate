# Vacate — Urban Task Force Leave Management & Payroll Bridge

Kissflow approval → Vacate dashboard → payroll import, with zero human touches.

## Stack
- **Next.js 14** (App Router) on **Vercel**
- **Supabase** (Postgres + Auth + Storage)
- Tailwind CSS, Recharts, lucide-react

## Run locally
```bash
npm install
npm run dev
```
Opens at http://localhost:3000 — runs on **built-in mock data** until Supabase env vars are set.

## Screens
- **Dashboard** — who's out today, pending payroll sync, YTD stats, charts, low-balance alerts
- **Leave Register** — searchable/filterable log of every synced request
- **Team Calendar** — month grid showing overlaps per employee
- **Payroll Exports** — one-click batch CSV of everything awaiting sync

## Wiring up production
1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` → `.env.local` and fill in the keys.
3. Import staff into the `employees` table (from the current Excel).
4. In Kissflow, add a **webhook on the final approval step** posting to
   `https://<app>.vercel.app/api/webhooks/kissflow` with header
   `X-Webhook-Secret`. Payload mapping is documented in
   `app/api/webhooks/kissflow/route.ts`. The upsert is idempotent on the
   Kissflow request ID, so retries never duplicate.
5. Payroll: once the system is confirmed, either
   - **API push** (SimplePay / PaySpace / Sage have REST APIs) via a Vercel
     cron job per pay run, or
   - **exact-format import file** generated automatically and delivered by
     email/SFTP.

## Still to come
- Auth (Supabase Auth, manager-scoped row-level security)
- Payroll-specific export format (waiting on payroll system confirmation)
- Balance import from the current Excel leave tracker
