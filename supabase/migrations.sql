
-- Add chunk_index to chunks table
alter table chunks add column if not exists chunk_index int;

-- Update the match_documents RPC to include document_id and chunk_index in return
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
  chunk_index int
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
    chunks.chunk_index
  from chunks
  join documents on documents.id = chunks.document_id
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  and documents.user_id = auth.uid()
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
