-- Cho phép admin cấp riêng quyền "được sửa Chính sách giá" cho từng nhân viên,
-- tách biệt khỏi quyền chỉ xem module này (đã có sẵn qua "discount_rules").
-- Mặc định false để giữ nguyên hành vi hiện tại (chỉ admin mới sửa được).

alter table public.users
  alter column permissions set default '{
    "floor_map": true,
    "kol": true,
    "history": true,
    "fixed_customers": true,
    "preferred_customers": true,
    "discount_rules": true,
    "discount_rules_edit": false,
    "checkin": true,
    "quick_booking": true
  }'::jsonb;

update public.users
set permissions = permissions || '{"discount_rules_edit": false}'::jsonb
where not (permissions ? 'discount_rules_edit');
