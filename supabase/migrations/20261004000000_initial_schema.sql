-- Abandoned Alley: the store's data, moved from Firestore to Supabase Postgres.
--
-- One table per former Firestore collection. Column names are the Firestore
-- field names in snake_case (discountAmount -> discount_amount); the app's
-- database client (src/lib/db.ts) converts between the two, so application
-- objects keep their familiar camelCase shape. Nested data that was a map or
-- an array of maps in Firestore stays together as jsonb.
--
-- Only the site's server talks to this database, over a direct Postgres
-- connection that bypasses Row Level Security. RLS is switched on with no
-- policies, so Supabase's public REST API (the anon key) can read or write
-- nothing — unlike the old open Firestore rules.

create table if not exists products (
  handle        text primary key,
  title         text not null default '',
  vendor        text not null default 'Abandoned Alley',
  description   text not null default '',
  -- Egypt price (EGP). Per-variant prices live in `variants`.
  price         double precision not null default 0,
  -- US price (USD); null = not sold in the New York store.
  price_usd     double precision,
  media         jsonb not null default '[]'::jsonb,
  options       jsonb not null default '[]'::jsonb,
  variants      jsonb not null default '[]'::jsonb,
  collection    text not null default '',
  disabled      boolean not null default false,
  -- Per-size stock, { "M": 6, ... }: Egypt store and New York store.
  stock         jsonb not null default '{}'::jsonb,
  stock_us      jsonb not null default '{}'::jsonb,
  size_chart_id text,
  sort_order    double precision,
  category      text,
  pairs_with    text[],
  updated_at    timestamptz not null default now()
);

create table if not exists collections (
  handle      text primary key,
  title       text not null default '',
  image       text not null default '',
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists size_charts (
  handle      text primary key,
  name        text not null,
  note        text,
  columns     text[] not null default '{}',
  column_defs jsonb not null default '[]'::jsonb,
  rows        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists promo_codes (
  code        text primary key,
  type        text not null check (type in ('percentage', 'fixed')),
  value       double precision not null,
  value_usd   double precision,
  valid_until timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Store-wide settings documents: 'store' (shipping fees, default size chart)
-- and 'offer' (the Egypt spend offer).
create table if not exists settings (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id         text primary key default gen_random_uuid()::text,
  name       text not null default '',
  email      text not null default '',
  message    text not null default '',
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists subscribers (
  email         text primary key,
  status        text not null default 'subscribed',
  subscribed_at timestamptz not null default now()
);

-- Analytics: one row per tracked visit.
create table if not exists sessions (
  id              text primary key default gen_random_uuid()::text,
  session_id      text,
  path            text,
  referrer        text,
  referrer_host   text,
  social_referrer text,
  country         text,
  region          text,
  city            text,
  utm             jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists sessions_created_at_idx on sessions (created_at desc);

create table if not exists orders (
  id                        text primary key,
  status                    text not null default 'pending',
  -- 'eg' | 'us': which store the order came from.
  region                    text not null default 'eg',
  currency                  text not null default 'EGP',
  customer                  jsonb not null,
  shipping                  jsonb not null,
  items                     jsonb not null,
  notes                     text,
  subtotal                  double precision not null default 0,
  discount_amount           double precision not null default 0,
  promo_code                text,
  shipping_fee              double precision not null default 0,
  shipping_zone             text,
  droppin_auto_push         boolean,
  attribution               jsonb,
  -- What the order took from stock, { "handle::size": qty }; the authority
  -- for restoring it on cancel/refund.
  stock_deducted            jsonb,
  created_at                timestamptz not null default now(),
  approved_at               timestamptz,
  delivered_at              timestamptz,
  cancelled_at              timestamptz,
  refunded_at               timestamptz,
  droppin_package_id        integer,
  droppin_tracking_number   text,
  droppin_status            text,
  droppin_pushed_at         timestamptz,
  droppin_error             text,
  droppin_push_attempted_at timestamptz,
  -- US card orders (Stripe).
  payment_method            text,
  payment_status            text,
  stripe_session_id         text,
  stripe_payment_intent_id  text,
  amount_paid               double precision,
  paid_at                   timestamptz,
  stripe_refund_id          text,
  -- Egypt spend offer, while it runs.
  offer_tier                text,
  offer_discount            double precision,
  delivery_fee_waived       double precision,
  -- Fields from retired integrations (ShipBlu), kept as they were.
  legacy                    jsonb
);
create index if not exists orders_created_at_idx on orders (created_at desc);

-- US card checkouts waiting on Stripe; become an order (same id) once paid.
create table if not exists checkouts (
  id                text primary key,
  status            text not null default 'open' check (status in ('open', 'paid', 'released')),
  region            text not null default 'us',
  currency          text not null default 'USD',
  customer          jsonb not null,
  shipping          jsonb not null,
  items             jsonb not null,
  notes             text,
  subtotal          double precision not null default 0,
  discount_amount   double precision not null default 0,
  promo_code        text,
  shipping_fee      double precision not null default 0,
  shipping_zone     text,
  droppin_auto_push boolean,
  attribution       jsonb,
  stock_deducted    jsonb,
  created_at        timestamptz not null default now(),
  stripe_session_id text,
  paid_at           timestamptz,
  released_at       timestamptz,
  release_reason    text
);

alter table products         enable row level security;
alter table collections      enable row level security;
alter table size_charts      enable row level security;
alter table promo_codes      enable row level security;
alter table settings         enable row level security;
alter table contact_messages enable row level security;
alter table subscribers      enable row level security;
alter table sessions         enable row level security;
alter table orders           enable row level security;
alter table checkouts        enable row level security;
