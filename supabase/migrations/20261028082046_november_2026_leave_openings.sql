-- Payroll rates are financial data: only the service role can read or write
-- this table. The server attaches rates after reading the staff master.
alter table public.employees
  add column if not exists monthly_accrual numeric;

create table if not exists public.employee_leave_rates (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  daily_cost_r numeric,
  updated_at timestamptz not null default now()
);
alter table public.employee_leave_rates enable row level security;
revoke all on public.employee_leave_rates from public, anon, authenticated;
grant select, insert, update, delete on public.employee_leave_rates to service_role;

-- The import is a single transaction. Only the server-side service role can
-- run it; existing request and payroll-export rows are not modified.
create or replace function public.apply_november_2026_openings(payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  row_data jsonb;
  v_employee_id uuid;
  loaded integer := 0;
begin
  if jsonb_typeof(payload->'employees') <> 'array'
     or jsonb_array_length(payload->'employees') <> 163 then
    raise exception 'Expected 163 complete staff rows';
  end if;
  if (select count(distinct value->>'employee_no') from jsonb_array_elements(payload->'employees')) <> 163 then
    raise exception 'Employee numbers must be unique';
  end if;
  for row_data in select value from jsonb_array_elements(payload->'employees') loop
    if nullif(row_data->>'employee_no', '') is null
       or row_data->>'opening_annual_balance' is null
       or row_data->>'monthly_accrual' is null then
      raise exception 'Incomplete employee row';
    end if;
    insert into public.employees (
      employee_no, name, department, role, annual_entitlement, sick_entitlement,
      monthly_accrual, opening_annual_balance, opening_sick_balance,
      opening_family_balance, opening_balance_as_of, excel_name, active
    ) values (
      row_data->>'employee_no', row_data->>'name', row_data->>'department', row_data->>'role',
      (row_data->>'annual_entitlement')::numeric, 30,
      (row_data->>'monthly_accrual')::numeric, (row_data->>'opening_annual_balance')::numeric,
      (row_data->>'opening_sick_balance')::numeric, (row_data->>'opening_family_balance')::numeric,
      '2026-11-01'::date, row_data->>'name', true
    ) on conflict (employee_no) do update set
      name = excluded.name, department = excluded.department, role = excluded.role,
      annual_entitlement = excluded.annual_entitlement, sick_entitlement = excluded.sick_entitlement,
      monthly_accrual = excluded.monthly_accrual, opening_annual_balance = excluded.opening_annual_balance,
      opening_sick_balance = excluded.opening_sick_balance, opening_family_balance = excluded.opening_family_balance,
      opening_balance_as_of = excluded.opening_balance_as_of, excel_name = excluded.excel_name, active = true
    returning id into v_employee_id;
    insert into public.employee_leave_rates (employee_id, daily_cost_r, updated_at)
    values (v_employee_id, (row_data->>'daily_cost_r')::numeric, now())
    on conflict (employee_id) do update set daily_cost_r = excluded.daily_cost_r, updated_at = excluded.updated_at;
    loaded := loaded + 1;
  end loop;

  update public.employees set active = false
  where employee_no not in (select value->>'employee_no' from jsonb_array_elements(payload->'employees'));

  -- Legacy identities already existed in the previous roster. Their codes are
  -- internal references, not payroll numbers, and they remain inactive.
  insert into public.employees (employee_no, name, department, role, active) values
    ('EMP0186', 'Siphiwe Enock Ntuli', 'Unassigned', 'Historical staff', false),
    ('EMP0149', 'Patric Ngobese', 'Unassigned', 'Historical staff', false),
    ('EMP0192', 'Siyabonga Mgidlana', 'Unassigned', 'Historical staff', false)
  on conflict (employee_no) do update set active = false;

  return jsonb_build_object('loaded', loaded, 'opening_as_of', '2026-11-01');
end;
$$;
revoke all on function public.apply_november_2026_openings(jsonb) from public, anon, authenticated;
grant execute on function public.apply_november_2026_openings(jsonb) to service_role;
