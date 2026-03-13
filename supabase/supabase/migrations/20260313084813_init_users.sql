create table user_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique,
  provider text not null,
  encrypted_api_key text not null,
  iv text not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table user_api_keys enable row level security;

create policy "service role only"
  on user_api_keys
  using ((select auth.role()) = 'service_role');
