alter table public.locations
  add column minimum_spend numeric;

alter table public.bookings
  add column actual_drink_spend numeric;
