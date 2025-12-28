-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store your documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(), -- Link to the user
  name text not null,
  type text not null,
  url text, -- Optional: if you store the file in Supabase Storage
  metadata jsonb,
  created_at timestamptz default now()
);

-- Enable RLS on documents
alter table documents enable row level security;

-- Policy: Users can only see their own documents
create policy "Users can view own documents"
on documents for select
to authenticated
using (auth.uid() = user_id);

-- Policy: Users can insert their own documents
create policy "Users can insert own documents"
on documents for insert
to authenticated
with check (auth.uid() = user_id);

-- Policy: Users can delete their own documents
create policy "Users can delete own documents"
on documents for delete
to authenticated
using (auth.uid() = user_id);

-- Create a table to store the chunks and their embeddings
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text,
  metadata jsonb,
  embedding vector(384), -- Matches the output of all-MiniLM-L6-v2
  created_at timestamptz default now()
);

-- Enable RLS on chunks
alter table chunks enable row level security;

-- Policy: Users can view chunks if they own the parent document
create policy "Users can view own chunks"
on chunks for select
to authenticated
using (
  exists (
    select 1 from documents
    where documents.id = chunks.document_id
    and documents.user_id = auth.uid()
  )
);

-- Policy: Users can insert chunks if they own the parent document
-- (Usually done by the server action acting as the user, so this is valid)
create policy "Users can insert own chunks"
on chunks for insert
to authenticated
with check (
  exists (
    select 1 from documents
    where documents.id = chunks.document_id
    and documents.user_id = auth.uid()
  )
);

-- Create a bucket for raw file uploads (if needed)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true) -- Kept public for simplicity in MVP, or make private
on conflict (id) do nothing;
