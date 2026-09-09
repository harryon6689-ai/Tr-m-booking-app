-- Chính sách giá linh hoạt + Khách cố định + trường thông tin khách mở rộng

-- ============ ENUM TYPES ============
create type public.customer_org_type as enum ('cá nhân', 'công ty/tổ chức');
create type public.pricing_mode as enum ('free_hours_plus_overage', 'flat_rate');
create type public.recurrence_type as enum ('hàng tuần', 'hàng tháng', 'ngày cụ thể');

-- ============ pricing_rules ============
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  location_type public.location_type not null,
  rule_name text not null,
  min_attendees int,
  max_attendees int,
  pricing_mode public.pricing_mode not null,
  free_hours numeric,
  overage_fee_per_hour numeric,
  flat_price numeric,
  flat_price_hours numeric,
  requires_drink_per_person boolean not null default false,
  active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint pricing_rules_attendee_range check (
    min_attendees is null or max_attendees is null or min_attendees <= max_attendees
  )
);

comment on table public.pricing_rules is 'Admin-configurable pricing policies per location type (free-hours+overage for rooms, flat-rate tiers for outdoor).';

-- ============ fixed_customers ============
create table public.fixed_customers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  customer_name text not null,
  phone text,
  recurrence_type public.recurrence_type not null,
  weekday int check (weekday between 0 and 6),
  day_of_month int check (day_of_month between 1 and 31),
  custom_dates date[],
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_until date,
  active boolean not null default true,
  note text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_customers_time_check check (end_time > start_time),
  constraint fixed_customers_effective_range check (
    effective_until is null or effective_until >= effective_from
  )
);

comment on table public.fixed_customers is 'Recurring reserved slots for regular customers, used to block conflicting one-off bookings.';

create index fixed_customers_location_idx on public.fixed_customers (location_id) where active;

create trigger fixed_customers_set_updated_at
  before update on public.fixed_customers
  for each row execute function public.set_updated_at();

-- ============ bookings: new columns ============
alter table public.bookings
  add column org_type public.customer_org_type not null default 'cá nhân',
  add column organization_name text,
  add column attendee_count int,
  add column equipment_needed text[] not null default '{}',
  add column equipment_note text,
  add column pricing_rule_id uuid references public.pricing_rules(id);

-- ============ RLS ============
alter table public.pricing_rules enable row level security;
alter table public.fixed_customers enable row level security;

create policy pricing_rules_admin_all on public.pricing_rules
  for all using (public.is_admin()) with check (public.is_admin());

create policy pricing_rules_staff_select on public.pricing_rules
  for select using (public.is_staff_or_admin());

create policy fixed_customers_admin_all on public.fixed_customers
  for all using (public.is_admin()) with check (public.is_admin());

create policy fixed_customers_staff_select on public.fixed_customers
  for select using (public.is_staff_or_admin());

-- ============ seed: pricing_rules matching current policy ============
insert into public.pricing_rules
  (location_type, rule_name, min_attendees, max_attendees, pricing_mode, free_hours, overage_fee_per_hour, flat_price, flat_price_hours, requires_drink_per_person, display_order)
values
  ('phòng lớn', 'Nhóm >10 người - miễn phí 4h đầu (kèm 1 đồ uống/người)', 11, null, 'free_hours_plus_overage', 4, 100000, null, null, true, 1),
  ('phòng nhỏ', 'Nhóm từ 5 người - miễn phí 4h đầu (kèm 1 đồ uống/người)', 5, null, 'free_hours_plus_overage', 4, 100000, null, null, true, 2),
  ('ghế ngoài', 'Sinh viên/CLB dưới 50 người', null, 49, 'flat_rate', null, null, 3000000, 3, false, 3),
  ('ghế ngoài', 'Workshop nhỏ 30-45 người', 30, 45, 'flat_rate', null, null, 4000000, 3, false, 4),
  ('ghế ngoài', 'Workshop thương mại từ 45 người', 45, null, 'flat_rate', null, null, 5000000, 3, false, 5);
