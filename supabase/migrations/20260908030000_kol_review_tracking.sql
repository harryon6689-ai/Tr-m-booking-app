-- Lịch KOL: theo dõi trạng thái review + SĐT KOL + link video đã đăng

alter table public.kol_bookings
  add column phone text,
  add column has_reviewed boolean not null default false,
  add column video_link text;

create index kol_bookings_has_reviewed_idx on public.kol_bookings (has_reviewed);
