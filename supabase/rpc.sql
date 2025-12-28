-- Existing schema...
-- (Previous content preserved implicitly, adding the new function at the end)

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
stable
as $$
begin
  return query
  select
    chunks.id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  join documents on documents.id = chunks.document_id
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  and documents.user_id = auth.uid() -- Critical: Only return chunks appearing in documents owned by the user
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
