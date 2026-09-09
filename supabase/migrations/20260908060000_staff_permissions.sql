-- Đăng nhập bằng SĐT + phân quyền chi tiết theo module cho từng nhân viên

alter table public.users
  add column permissions jsonb not null default '{
    "floor_map": true,
    "kol": true,
    "history": true,
    "fixed_customers": true,
    "preferred_customers": true,
    "discount_rules": true
  }'::jsonb;

create unique index users_phone_unique_idx on public.users (phone) where phone is not null;
