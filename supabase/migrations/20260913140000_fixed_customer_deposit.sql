alter table public.fixed_customers
  add column deposit_amount numeric not null default 0;
