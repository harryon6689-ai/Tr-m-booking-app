-- Cho phép khách cố định "hàng tháng"/"hàng quý" lặp lại vào nhiều ngày trong
-- tháng thay vì chỉ 1 ngày. "hàng năm" chuyển sang dùng custom_dates (ngày/tháng,
-- bỏ qua năm) để hỗ trợ nhiều cặp ngày/tháng — month_of_year không còn cần thiết.

alter table public.fixed_customers
  drop constraint if exists fixed_customers_day_of_month_check;

alter table public.fixed_customers
  alter column day_of_month type int[]
  using case when day_of_month is null then null else array[day_of_month] end;

alter table public.fixed_customers
  add constraint fixed_customers_day_of_month_check check (
    day_of_month is null or day_of_month <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]
  );

alter table public.fixed_customers drop column month_of_year;

comment on column public.fixed_customers.day_of_month is 'Array of days-of-month (1-31) the rule occurs on, used for ''hàng tháng''/''hàng quý''.';
comment on column public.fixed_customers.custom_dates is 'For ''ngày cụ thể'': exact one-time dates. For ''hàng năm'': day+month of each date recurs every year (the year component is ignored).';
