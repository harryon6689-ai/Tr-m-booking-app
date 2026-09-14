alter table public.bookings
  add column vat_invoice_requested boolean not null default false,
  add column vat_company_name text,
  add column vat_company_address text,
  add column vat_tax_code text,
  add column vat_email text;
