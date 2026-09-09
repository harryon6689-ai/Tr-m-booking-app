alter table public.users
  add column view_only boolean not null default false;

comment on column public.users.view_only is 'When true (staff only — admins always keep full access), the account can view permitted modules but cannot create/edit/cancel bookings.';
