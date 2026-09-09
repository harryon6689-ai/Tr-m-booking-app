-- Sổ khách VIP/KOL: lưu hồ sơ + chính sách giảm giá riêng, dùng để tự nhận diện
-- và tự điền thông tin khi tạo booking cho đúng khách đó.

create table public.preferred_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  customer_type public.customer_type not null default 'VIP',
  org_type public.customer_org_type not null default 'cá nhân',
  organization_name text,
  custom_discount_percent numeric,
  equipment_needed text[] not null default '{}',
  equipment_note text,
  note text,
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.preferred_customers is 'VIP/KOL customer directory with a custom discount policy, used to auto-suggest and prefill booking info when the matching name/phone is entered.';

create index preferred_customers_phone_idx on public.preferred_customers (phone) where phone is not null;

create trigger preferred_customers_set_updated_at
  before update on public.preferred_customers
  for each row execute function public.set_updated_at();

alter table public.preferred_customers enable row level security;

create policy preferred_customers_admin_all on public.preferred_customers
  for all using (public.is_admin()) with check (public.is_admin());

create policy preferred_customers_staff_select on public.preferred_customers
  for select using (public.is_staff_or_admin());
