-- Cho phép khách cố định "hàng tuần" lặp lại vào nhiều thứ trong tuần thay vì chỉ 1 thứ.

alter table public.fixed_customers
  drop constraint if exists fixed_customers_weekday_check;

alter table public.fixed_customers
  alter column weekday type int[] using case when weekday is null then null else array[weekday] end;

alter table public.fixed_customers
  add constraint fixed_customers_weekday_check check (
    weekday is null or weekday <@ array[0,1,2,3,4,5,6]
  );

comment on column public.fixed_customers.weekday is 'Array of weekdays (0=Sun..6=Sat) the rule occurs on, used only when recurrence_type = ''hàng tuần''.';
