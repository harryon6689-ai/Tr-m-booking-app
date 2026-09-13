alter table public.users
  alter column permissions set default '{
    "floor_map": true,
    "checkin": true,
    "quick_booking": true,
    "kol": true,
    "history": true,
    "fixed_customers": true,
    "preferred_customers": true,
    "discount_rules": true
  }'::jsonb;

update public.users
set permissions = permissions || '{"quick_booking": true}'::jsonb
where not (permissions ? 'quick_booking');
