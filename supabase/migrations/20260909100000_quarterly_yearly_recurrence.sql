alter type public.recurrence_type add value 'hàng quý';
alter type public.recurrence_type add value 'hàng năm';

alter table public.fixed_customers
  add column month_of_year int check (month_of_year between 1 and 12);

comment on column public.fixed_customers.month_of_year is 'Used only when recurrence_type = ''hàng năm'' (yearly), together with day_of_month.';
