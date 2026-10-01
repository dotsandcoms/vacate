-- Private payroll files: API authorization is enforced by the application.
create table public.payroll_export_batches (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table public.payroll_export_requests (
  request_id text primary key,
  batch_id text not null references public.payroll_export_batches(id)
);
alter table public.payroll_export_batches enable row level security;
alter table public.payroll_export_requests enable row level security;
revoke all on public.payroll_export_batches, public.payroll_export_requests from anon, authenticated;
grant all on public.payroll_export_batches, public.payroll_export_requests to service_role;

create function public.save_payroll_export(batch jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.payroll_export_batches(id, payload) values (batch->>'id', batch);
  insert into public.payroll_export_requests(request_id, batch_id)
    select value, batch->>'id' from jsonb_array_elements_text(batch->'requestIds');
end;
$$;
revoke all on function public.save_payroll_export(jsonb) from public, anon, authenticated;
grant execute on function public.save_payroll_export(jsonb) to service_role;
