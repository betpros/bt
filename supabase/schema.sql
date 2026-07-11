-- BetPro orders table
-- Run this once in the Supabase SQL editor for your project.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  service_description text,
  amount numeric(12, 2) not null,
  -- which button the customer clicked (mpesa / pesapal) — both are actually
  -- processed through PesaPal's hosted checkout, this is just for your records
  method text not null default 'pesapal',
  status text not null default 'PENDING', -- PENDING | COMPLETED | FAILED | INVALID
  pesapal_order_tracking_id text,
  pesapal_merchant_reference text,
  pesapal_confirmation_code text,
  pesapal_payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_tracking_id_idx on public.orders (pesapal_order_tracking_id);
create index if not exists orders_status_idx on public.orders (status);

-- Keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Row Level Security: the backend talks to Supabase with the service role
-- key, which bypasses RLS, so this just locks the table down from any
-- client-side (anon key) access.
alter table public.orders enable row level security;
