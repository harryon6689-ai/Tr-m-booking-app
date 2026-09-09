-- Lịch KOL:
-- - "Người Book KOL": tên nhập tay (khác với tài khoản đăng nhập tạo bản ghi)
-- - "KOL hiệu quả": đánh dấu để lên kế hoạch book lại lần sau
-- - Nhiều link video đã đăng (đăng nhiều nền tảng cùng lúc) thay vì 1 link duy nhất

alter table public.kol_bookings
  add column booked_by_name text,
  add column is_effective boolean not null default false,
  add column video_links text[] not null default '{}';

update public.kol_bookings
set video_links = array[video_link]
where video_link is not null and video_link <> '';

alter table public.kol_bookings drop column video_link;
