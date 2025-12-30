-- Drop first to change return signature
drop function if exists match_documents(vector, float, int);

-- Re-create with 'name' (filename) in the return table
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  chunk_index int,
  name text
)
language plpgsql
stable
as $$
begin
  return query
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity,
    chunks.chunk_index,
    documents.name
  from chunks
  join documents on documents.id = chunks.document_id
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  and documents.user_id = auth.uid()
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
