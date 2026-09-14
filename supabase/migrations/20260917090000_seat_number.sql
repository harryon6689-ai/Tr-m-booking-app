-- Vị trí cụ thể (số ghế/số bàn) cho khách đặt ở khu ngồi ngoài.

alter table public.bookings add column seat_number text;
alter table public.fixed_customers add column seat_number text;

comment on column public.bookings.seat_number is 'Số vị trí cụ thể trong khu ngồi ngoài (location.type = ''ghế ngoài''), nhập tự do.';
comment on column public.fixed_customers.seat_number is 'Số vị trí cụ thể trong khu ngồi ngoài (location.type = ''ghế ngoài''), nhập tự do.';
