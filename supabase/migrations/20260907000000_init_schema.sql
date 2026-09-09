-- TRẠM Coworking Place — Initial schema
-- Tables: locations, bookings, kol_bookings, discount_rules, users
-- + role helper functions + RLS policies (admin/staff)

create extension if not exists "pgcrypto";

-- ============ ENUM TYPES ============
create type public.location_type as enum ('phòng lớn', 'phòng nhỏ', 'box', 'ghế ngoài');
create type public.booking_status as enum ('đã đặt', 'đã tới', 'hủy');
create type public.customer_type as enum ('thường', 'VIP', 'KOL');
create type public.discount_type as enum ('phòng', 'đồ uống');
create type public.user_role as enum ('admin', 'staff');

-- ============ TABLES ============

-- users: profile table linked 1:1 to auth.users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role public.user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.users is 'Profile + role for each authenticated staff/admin account.';

-- locations: physical spaces on the floor map
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.location_type not null,
  capacity int not null,
  equipment text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.locations is 'Rooms/boxes/outdoor area shown on the admin floor map grid.';

-- bookings: reservations against a location
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  customer_name text not null,
  phone text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.booking_status not null default 'đã đặt',
  deposit_amount numeric(12,0) not null default 0,
  discount_applied numeric(5,2) not null default 0,
  final_price numeric(12,0) not null default 0,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_check check (end_time > start_time)
);

comment on table public.bookings is 'Customer bookings for a location; drives the floor map colors.';

create index bookings_location_time_idx on public.bookings (location_id, start_time, end_time);
create index bookings_status_idx on public.bookings (status);

-- kol_bookings: fully separate KOL visit schedule, not shown on the floor map
create table public.kol_bookings (
  id uuid primary key default gen_random_uuid(),
  kol_name text not null,
  platform text,
  follower_count int,
  visit_date date not null,
  start_time time,
  end_time time,
  deal_type text,
  content_deliverable text,
  status public.booking_status not null default 'đã đặt',
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kol_bookings is 'KOL visit schedule, managed in its own module/tab.';

create index kol_bookings_visit_date_idx on public.kol_bookings (visit_date);

-- discount_rules: default discount percentages, editable by admin only
create table public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  customer_type public.customer_type not null,
  discount_type public.discount_type not null,
  default_percent numeric(5,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (customer_type, discount_type)
);

comment on table public.discount_rules is 'Default discount % per customer type / discount type; admin-editable.';

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger kol_bookings_set_updated_at
  before update on public.kol_bookings
  for each row execute function public.set_updated_at();

-- ============ role helper functions (security definer to avoid RLS recursion) ============
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role from public.users where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and active = true
  );
$$;

-- ============ RLS ============
alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.bookings enable row level security;
alter table public.kol_bookings enable row level security;
alter table public.discount_rules enable row level security;

-- users: admin full access; any authenticated user can read own row
create policy users_admin_all on public.users
  for all using (public.is_admin()) with check (public.is_admin());

create policy users_select_self on public.users
  for select using (id = auth.uid());

-- locations: admin full CRUD; staff read-only
create policy locations_admin_all on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

create policy locations_staff_select on public.locations
  for select using (public.is_staff_or_admin());

-- bookings: admin full CRUD; staff can select/insert/update (no delete -> use status = 'hủy')
create policy bookings_admin_all on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

create policy bookings_staff_select on public.bookings
  for select using (public.is_staff_or_admin());

create policy bookings_staff_insert on public.bookings
  for insert with check (public.is_staff_or_admin());

create policy bookings_staff_update on public.bookings
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- kol_bookings: same pattern as bookings
create policy kol_bookings_admin_all on public.kol_bookings
  for all using (public.is_admin()) with check (public.is_admin());

create policy kol_bookings_staff_select on public.kol_bookings
  for select using (public.is_staff_or_admin());

create policy kol_bookings_staff_insert on public.kol_bookings
  for insert with check (public.is_staff_or_admin());

create policy kol_bookings_staff_update on public.kol_bookings
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- discount_rules: admin full CRUD; staff read-only (view default %, cannot edit)
create policy discount_rules_admin_all on public.discount_rules
  for all using (public.is_admin()) with check (public.is_admin());

create policy discount_rules_staff_select on public.discount_rules
  for select using (public.is_staff_or_admin());

-- ============ seed: floor map locations ============
insert into public.locations (name, type, capacity, equipment, display_order) values
  ('Phòng họp lớn', 'phòng lớn', 20, 'Màn hình tương tác', 1),
  ('Phòng họp nhỏ', 'phòng nhỏ', 10, 'Máy chiếu', 2),
  ('Box 1', 'box', 2, null, 3),
  ('Box 2', 'box', 2, null, 4),
  ('Box 3', 'box', 2, null, 5),
  ('Box 4', 'box', 2, null, 6),
  ('Khu ngồi ngoài', 'ghế ngoài', 30, null, 7);

-- ============ seed: default discount rules ============
insert into public.discount_rules (customer_type, discount_type, default_percent, active) values
  ('thường', 'phòng', 0, true),
  ('thường', 'đồ uống', 0, true),
  ('VIP', 'phòng', 10, true),
  ('VIP', 'đồ uống', 10, true),
  ('KOL', 'phòng', 20, true),
  ('KOL', 'đồ uống', 15, true);
