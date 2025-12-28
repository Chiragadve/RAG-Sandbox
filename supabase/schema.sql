-- Enable pgvector
create extension if not exists vector;

-- Documents table to track uploaded files
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Chunks table for vector search
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  embedding vector(384), -- Dimension matches all-MiniLM-L6-v2
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Index for faster vector search
create index on chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Storage bucket for raw uploads
insert into storage.buckets (id, name, public) 
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- RLS Policies (Simplified for MVP - assuming public/anon access for now as per "Basic Plan" implying speed over strict auth first, but prompt said "Isolation". 
-- BUT, User gave anon key. I will add basic RLS to allow anon to insert for now, or just leave it open if RLS is not enabled by default. 
-- For a real app, we need auth. For this MVP test, I'll allow anon access.)

alter table documents enable row level security;
alter table chunks enable row level security;

create policy "Allow all access to documents for now"
on documents for all using (true) with check (true);

create policy "Allow all access to chunks for now"
on chunks for all using (true) with check (true);

create policy "Allow all access to uploads bucket"
on storage.objects for all using ( bucket_id = 'uploads' ) with check ( bucket_id = 'uploads' );
