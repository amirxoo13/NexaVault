create table if not exists push_config (
  id text primary key,
  public_key text not null,
  private_key text not null,
  last_price_at bigint not null default 0,
  last_balance_at bigint not null default 0
);

create table if not exists push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
