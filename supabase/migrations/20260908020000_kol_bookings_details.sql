-- Lịch KOL: thêm link kênh, giá review, và quà tặng (đồ uống/bánh + số lượng)

alter table public.kol_bookings
  add column channel_link text,
  add column review_price numeric not null default 0,
  add column gift_drink boolean not null default false,
  add column gift_drink_quantity int,
  add column gift_cake boolean not null default false,
  add column gift_cake_quantity int;
