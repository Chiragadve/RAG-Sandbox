-- Create 'documents' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

-- Create 'podcasts' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('podcasts', 'podcasts', true)
on conflict (id) do nothing;

-- Removed ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; (Usually requires superuser, and is on by default)

-- Policies --

-- Policy: Allow authenticated users to upload to 'documents'
drop policy if exists "Authenticated users can upload documents" on storage.objects;
create policy "Authenticated users can upload documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'documents' );

-- Policy: Allow authenticated users to upload to 'podcasts'
drop policy if exists "Authenticated users can upload podcasts" on storage.objects;
create policy "Authenticated users can upload podcasts"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'podcasts' );

-- Policy: Allow public to view assets (if public bucket)
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id in ('documents', 'podcasts') );
