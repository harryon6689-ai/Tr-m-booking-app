create table public.fixed_customer_checkins (
  fixed_customer_id uuid not null references public.fixed_customers(id) on delete cascade,
  occurrence_date date not null,
  arrived boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  primary key (fixed_customer_id, occurrence_date)
);

comment on table public.fixed_customer_checkins is 'Per-occurrence arrival tracking for recurring "khách cố định" reservations, keyed by the specific calendar date they occur on.';

alter table public.fixed_customer_checkins enable row level security;

create policy fixed_customer_checkins_admin_all on public.fixed_customer_checkins
  for all using (public.is_admin()) with check (public.is_admin());

create policy fixed_customer_checkins_staff_select on public.fixed_customer_checkins
  for select using (public.is_staff_or_admin());

create policy fixed_customer_checkins_staff_insert on public.fixed_customer_checkins
  for insert with check (public.is_editor());

create policy fixed_customer_checkins_staff_update on public.fixed_customer_checkins
  for update using (public.is_editor()) with check (public.is_editor());
