-- Append-only corrections overlay Kissflow after each sync. Payroll export
-- files and request export locks remain part of their original audit trail.
create table public.leave_request_adjustments (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.employees(id),
  kissflow_id text not null check (length(kissflow_id) between 1 and 200),
  type text not null check (type in (
    'Annual', 'Sick', 'Family Responsibility', 'Maternity/Paternity', 'Study', 'Unpaid'
  )),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  days numeric not null check (days > 0 and days <= 366 and days = round(days, 2)),
  reason text not null check (length(trim(reason)) between 1 and 1000),
  previous_values jsonb not null,
  adjusted_by uuid references auth.users(id) on delete set null,
  adjusted_by_name text not null,
  created_at timestamptz not null default now()
);

create index leave_request_adjustments_request_idx
  on public.leave_request_adjustments (employee_id, kissflow_id, id desc);
create index leave_request_adjustments_actor_idx
  on public.leave_request_adjustments (adjusted_by);

alter table public.leave_request_adjustments enable row level security;
revoke all on public.leave_request_adjustments from anon, authenticated;
grant select, insert on public.leave_request_adjustments to service_role;
grant usage, select on sequence public.leave_request_adjustments_id_seq to service_role;
