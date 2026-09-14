alter table public.locations
  add column included_hours numeric not null default 4,
  add column overage_fee_per_hour numeric;

alter table public.bookings
  add column overage_fee_paid boolean not null default false,
  add column minimum_spend_shortfall_paid boolean not null default false;

comment on column public.bookings.overage_fee is 'Auto-computed extra charge for exceeding the location''s included hours.';
