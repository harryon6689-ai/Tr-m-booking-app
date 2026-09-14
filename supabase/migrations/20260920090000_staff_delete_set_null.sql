-- Xoá tài khoản nhân viên đang bị Postgres chặn khi họ đã từng tạo booking/
-- khách cố định/KOL/khách VIP (ràng buộc khoá ngoại created_by mặc định là
-- RESTRICT). Đổi sang ON DELETE SET NULL: xoá tài khoản vẫn được, dữ liệu họ
-- từng tạo được giữ nguyên, chỉ mất thông tin "người tạo" (đặt về NULL).

alter table public.bookings
  drop constraint bookings_created_by_fkey,
  add constraint bookings_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.kol_bookings
  drop constraint kol_bookings_created_by_fkey,
  add constraint kol_bookings_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.fixed_customers
  drop constraint fixed_customers_created_by_fkey,
  add constraint fixed_customers_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.preferred_customers
  drop constraint preferred_customers_created_by_fkey,
  add constraint preferred_customers_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;
