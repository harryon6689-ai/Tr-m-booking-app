create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role = 'admin' or not view_only
     from public.users
     where id = auth.uid() and active = true),
    false
  );
$$;

drop policy if exists bookings_staff_insert on public.bookings;
create policy bookings_staff_insert on public.bookings
  for insert with check (public.is_editor());

drop policy if exists bookings_staff_update on public.bookings;
create policy bookings_staff_update on public.bookings
  for update using (public.is_editor()) with check (public.is_editor());

drop policy if exists kol_bookings_staff_insert on public.kol_bookings;
create policy kol_bookings_staff_insert on public.kol_bookings
  for insert with check (public.is_editor());

drop policy if exists kol_bookings_staff_update on public.kol_bookings;
create policy kol_bookings_staff_update on public.kol_bookings
  for update using (public.is_editor()) with check (public.is_editor());
