-- Opening balances from Excel leave register (baseline for Vacate).
-- Run in the Supabase SQL editor after schema.sql.

alter table employees
  add column if not exists opening_annual_balance numeric,
  add column if not exists opening_sick_balance numeric,
  add column if not exists opening_family_balance numeric,
  add column if not exists opening_balance_as_of date,
  add column if not exists excel_name text;

comment on column employees.opening_annual_balance is
  'Annual days remaining from Excel due-as-at row at cutover';
comment on column employees.opening_balance_as_of is
  'Cutover date for Excel baseline; Kissflow leave after this date reduces remaining';
