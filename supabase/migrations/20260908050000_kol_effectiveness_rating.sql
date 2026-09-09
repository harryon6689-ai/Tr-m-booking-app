-- Lịch KOL: đổi đánh dấu "hiệu quả" (boolean) sang đánh giá theo sao 1-5

alter table public.kol_bookings
  add column effectiveness_rating int not null default 0
    check (effectiveness_rating between 0 and 5);

update public.kol_bookings
set effectiveness_rating = case when is_effective then 5 else 0 end;

alter table public.kol_bookings drop column is_effective;
