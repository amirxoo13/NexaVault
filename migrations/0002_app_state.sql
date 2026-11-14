-- Shared site + wallet state so every browser sees the same admin edits.
create table if not exists app_state (
  id          text primary key,
  site_json   text not null default '{}',
  wallet_json text not null default '{}',
  login_json  text not null default '{}',
  updated_at  timestamptz not null default now()
);

insert into app_state (id) values ('aurex')
on conflict (id) do nothing;
