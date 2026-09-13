alter table public.bookings
  add column deposit_refunded boolean not null default false,
  add column overage_fee numeric not null default 0;

comment on column public.bookings.deposit_refunded is 'Whether the customer''s deposit has been returned (only meaningful when deposit_amount > 0).';
comment on column public.bookings.overage_fee is 'Manually entered extra charge for exceeding the booked time, per pricing policy.';
