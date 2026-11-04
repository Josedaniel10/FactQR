create extension if not exists pgcrypto;

create type order_mode as enum ('A', 'B');
create type order_status as enum (
  'DRAFT',
  'PAYMENT_PENDING',
  'PAID',
  'INVOICING',
  'INVOICED',
  'INVOICE_FAILED',
  'PAYMENT_EXPIRED',
  'CANCELLED',
  'CREDIT_NOTE_ISSUED'
);
create type payment_status as enum (
  'PENDING',
  'READY',
  'PAID',
  'EXPIRED',
  'FAILED'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  mode order_mode not null,
  status order_status not null default 'DRAFT',
  total numeric(12, 2) not null check (total >= 0),
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  document_type text not null,
  document_number text not null,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  unique (merchant_id, document_type, document_number)
);

alter table public.orders
  add constraint orders_customer_fk
  foreign key (customer_id) references public.customers(id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  code_reference text not null,
  name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  tax_code text not null default '01',
  tax_rate numeric(6, 2) not null check (tax_rate >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reference_code text not null unique,
  amount numeric(12, 2) not null check (amount >= 0),
  status payment_status not null default 'PENDING',
  breb_key text,
  qr_base64 text,
  qr_expires_at timestamptz,
  collected_at timestamptz,
  payer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reference_code text not null unique,
  number text,
  cufe text,
  is_validated boolean not null default false,
  public_url text,
  errors jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null default auth.uid(),
  invoice_id uuid not null references public.invoices(id),
  reference_code text not null unique,
  number text,
  cufe text,
  is_validated boolean not null default false,
  public_url text,
  errors jsonb,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  reference_code text,
  raw_body jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result jsonb
);

create table public.api_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references auth.users(id),
  service text not null,
  endpoint text not null,
  request jsonb,
  response jsonb,
  http_status integer,
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

create table public.integration_tokens (
  service text primary key,
  token_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.credit_notes enable row level security;
alter table public.webhook_events enable row level security;
alter table public.api_logs enable row level security;
alter table public.integration_tokens enable row level security;

create policy "Merchants manage their customers"
  on public.customers for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants manage their orders"
  on public.orders for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants manage their order items"
  on public.order_items for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants manage their payments"
  on public.payments for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants manage their invoices"
  on public.invoices for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants manage their credit notes"
  on public.credit_notes for all to authenticated
  using (merchant_id = auth.uid()) with check (merchant_id = auth.uid());

create policy "Merchants read their api logs"
  on public.api_logs for select to authenticated
  using (merchant_id = auth.uid());

create index orders_merchant_status_idx on public.orders (merchant_id, status);
create index order_items_order_idx on public.order_items (order_id);
create index payments_reference_idx on public.payments (reference_code);
create index payments_order_status_idx on public.payments (order_id, status);
create index invoices_reference_idx on public.invoices (reference_code);
create index webhook_events_reference_idx on public.webhook_events (reference_code);
