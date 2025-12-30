-- Create 'integrations' table for storing OAuth tokens
create table if not exists integrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  service text not null, -- e.g. 'gmail'
  tokens jsonb,          -- Store access_token, refresh_token etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id, service)
);

-- RLS
alter table integrations enable row level security;

create policy "Users can view own integrations"
  on integrations for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert/update own integrations"
  on integrations for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own integrations"
  on integrations for update
  to authenticated
  using (auth.uid() = user_id);
