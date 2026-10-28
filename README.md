# Vacate — Urban Task Force Leave Management & Payroll Bridge

Kissflow approval → Vacate dashboard → payroll import, with zero human touches.

## Stack
- **Next.js 16** (App Router) on **Vercel**
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
2. Run `supabase/migrations/002_app_users_auth.sql` to create role-based access profiles.
3. Copy `.env.example` → `.env.local`, fill in the keys, and set
   `BOOTSTRAP_ADMIN_EMAILS` to the first trusted administrator's email.
4. In Supabase Auth, configure the application URL and `/auth/callback` as an
   allowed redirect URL. The dashboard supports password and passwordless email sign-in.
5. Import staff into the `employees` table (from the current Excel).
6. In Kissflow, add a **webhook on the final approval step** posting to
   `https://<app>.vercel.app/api/webhooks/kissflow` with header
   `X-Webhook-Secret`. Payload mapping is documented in
   `app/api/webhooks/kissflow/route.ts`. The upsert is idempotent on the
   Kissflow request ID, so retries never duplicate.
7. Payroll: once the system is confirmed, either
   - **API push** (SimplePay / PaySpace / Sage have REST APIs) via a Vercel
     cron job per pay run, or
   - **exact-format import file** generated automatically and delivered by
     email/SFTP.

## Access control

- **Administrator** — full access and user administration.
- **CFO / Finance** — full operational and payroll access.
- **Department manager** — read-only data scoped to the assigned department;
  no payroll or user administration access.

All pages and APIs validate the Supabase session on the server. Administrators
can invite, assign and revoke users from **User Access** in the dashboard.

Notifications are stored durably in Supabase with per-user read state. Run
`supabase/migrations/003_durable_notifications.sql` before deploying the
notification changes. Kissflow approvals sent to the secured webhook generate
notifications immediately; other request and status changes are reconciled
during the next live Kissflow sync. On Vercel Pro, `vercel.json` runs the
read-only Kissflow reconciliation every five minutes, including when nobody has
the dashboard open. Add a long random `CRON_SECRET` to the Production
environment before deploying; Vercel sends it as a Bearer token automatically.

If the existing Vercel project is owned by a Hobby account, transfer that same
project to the Pro team before deploying the cron configuration. The transfer
preserves the live project, domains, environment variables, deployments, and
Git connection; third-party Vercel integrations should be checked afterwards.

## Still to come
- Payroll import acceptance and database installation: see [Payroll export requirements and operator guide](docs/payroll-export-requirements.md).

## November 2026 openings → Kissflow live

The approved `Leave app load (Brad)` workbook sheet supplies opening balances
as at **1 November 2026**, individual monthly accrual rates and daily leave
rates. Approved Kissflow leave on or after that date is reserved against the
opening; November accrual is added at month end. Sick and family responsibility
openings use the workbook's taken figures and the agreed allowances.

Apply `supabase/migrations/20261028082046_november_2026_leave_openings.sql`
before the import. The import requires Python 3 and `openpyxl`, plus the
Supabase service role credentials in `.env.local`. Preview first:

```bash
npm run import:excel -- --xlsx '/path/to/Leave Balances October 2026_3.xlsx'
```

After reviewing the preview, apply the same workbook:

```bash
npm run import:excel:apply -- --xlsx '/path/to/Leave Balances October 2026_3.xlsx'
```

Apply saves a private local backup and uses one database transaction. The
workbook's incomplete Sizakele record remains on hold; Sanele's missing day rate
is shown as unavailable. The import verifies all 163 loaded rows afterwards.
