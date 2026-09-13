alter table public.users
  alter column permissions set default '{
    "floor_map": true,
    "kol": true,
    "history": true,
    "fixed_customers": true,
    "preferred_customers": true,
    "discount_rules": true,
    "checkin": true
  }'::jsonb;

update public.users
set permissions = permissions || '{"checkin": true}'::jsonb
where not (permissions ? 'checkin');
