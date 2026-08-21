-- Application access control for the UTF-Leave management dashboard.
-- Run in the Supabase SQL editor before enabling authentication in production.

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('admin', 'cfo', 'department_manager')),
  department text,
  active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_manager_requires_department check (
    role <> 'department_manager' or nullif(trim(department), '') is not null
  )
);

create index if not exists idx_app_users_email on public.app_users(lower(email));
create index if not exists idx_app_users_role_active on public.app_users(role, active);

alter table public.app_users enable row level security;

drop policy if exists "Users read own access profile" on public.app_users;
create policy "Users read own access profile" on public.app_users
  for select to authenticated
  using (user_id = auth.uid());

-- User administration is performed only by server routes using the service
-- role. No browser-side INSERT, UPDATE, or DELETE policy is intentionally set.
