-- Vacate (Urban Task Force) · Supabase schema
-- Run in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  employee_no text unique not null,
  name text not null,
  department text not null,
  role text,
  annual_entitlement numeric not null default 15,
  sick_entitlement numeric not null default 30,
  -- Excel baseline (Staff Leave register). When set, balances = opening
  -- minus Kissflow leave starting after opening_balance_as_of (+ accrual).
  opening_annual_balance numeric,
  opening_sick_balance numeric,
  opening_family_balance numeric,
  opening_balance_as_of date,
  excel_name text,
  created_at timestamptz not null default now()
);

create table if not exists leave_requests (
  id uuid primary key default uuid_generate_v4(),
  kissflow_id text unique not null,          -- idempotency key from Kissflow
  employee_id uuid not null references employees(id),
  type text not null check (type in (
    'Annual','Sick','Family Responsibility','Maternity/Paternity','Study','Unpaid'
  )),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  days numeric not null check (days > 0),
  status text not null default 'Pending Sync' check (status in (
    'Approved','Pending Sync','Exported','Cancelled'
  )),
  approved_by text,
  approved_at timestamptz,
  notes text,
  exported_at timestamptz,
  export_batch_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists export_batches (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  created_by text,
  record_count int not null,
  total_days numeric not null,
  payroll_system text,                        -- e.g. 'SimplePay', 'Sage', 'PaySpace'
  file_path text                              -- Supabase Storage path of generated file
);

create index if not exists idx_leave_requests_status on leave_requests(status);
create index if not exists idx_leave_requests_dates on leave_requests(start_date, end_date);

-- Row Level Security: management dashboard users read everything;
-- writes only via the service role (webhook + export jobs).
alter table employees enable row level security;
alter table leave_requests enable row level security;
alter table export_batches enable row level security;

create policy "Authenticated read employees" on employees
  for select to authenticated using (true);
create policy "Authenticated read leave" on leave_requests
  for select to authenticated using (true);
create policy "Authenticated read batches" on export_batches
  for select to authenticated using (true);
