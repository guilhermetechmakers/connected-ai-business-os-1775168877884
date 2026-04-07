-- Knowledge Base vector index + storage + semantic retrieval (idempotent)

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.indexed_documents
  ADD COLUMN IF NOT EXISTS index_status text NOT NULL DEFAULT 'pending'
    CHECK (index_status IN ('pending', 'indexing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_indexed_at timestamptz,
  ADD COLUMN IF NOT EXISTS index_error text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

CREATE TABLE IF NOT EXISTS public.indexed_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.indexed_documents (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  token_count integer NOT NULL DEFAULT 0,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_indexed_document_chunks_company
  ON public.indexed_document_chunks (company_id);

CREATE INDEX IF NOT EXISTS idx_indexed_document_chunks_doc
  ON public.indexed_document_chunks (document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_indexed_document_chunks_fts
  ON public.indexed_document_chunks
  USING gin (to_tsvector('english', coalesce(chunk_text, '')));

CREATE INDEX IF NOT EXISTS idx_indexed_document_chunks_embedding_cos
  ON public.indexed_document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.indexed_document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS indexed_document_chunks_all ON public.indexed_document_chunks;
CREATE POLICY indexed_document_chunks_all ON public.indexed_document_chunks
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- Storage bucket for uploaded KB source files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base',
  'knowledge-base',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
    'text/markdown'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS kb_objects_insert_tenant ON storage.objects;
CREATE POLICY kb_objects_insert_tenant ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-base'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS kb_objects_select_tenant ON storage.objects;
CREATE POLICY kb_objects_select_tenant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'knowledge-base'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS kb_objects_update_tenant ON storage.objects;
CREATE POLICY kb_objects_update_tenant ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'knowledge-base'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'knowledge-base'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS kb_objects_delete_tenant ON storage.objects;
CREATE POLICY kb_objects_delete_tenant ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'knowledge-base'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

CREATE OR REPLACE FUNCTION public.match_indexed_document_chunks(
  p_query_embedding vector(1536),
  p_match_count integer DEFAULT 12,
  p_min_similarity real DEFAULT 0.15
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_index integer,
  chunk_text text,
  token_count integer,
  similarity real,
  source_provider text,
  title text,
  external_id text,
  permissions jsonb,
  department_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.chunk_index,
    c.chunk_text,
    c.token_count,
    (1 - (c.embedding <=> p_query_embedding))::real AS similarity,
    d.source_provider,
    d.title,
    d.external_id,
    d.permissions,
    d.department_id
  FROM public.indexed_document_chunks c
  JOIN public.indexed_documents d
    ON d.id = c.document_id
   AND d.company_id = c.company_id
  WHERE c.company_id = public.current_company_id()
    AND c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> p_query_embedding)) >= GREATEST(LEAST(p_min_similarity, 1), 0)
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(LEAST(p_match_count, 60), 1);
$$;

REVOKE ALL ON FUNCTION public.match_indexed_document_chunks(vector, integer, real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_indexed_document_chunks(vector, integer, real) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_indexed_document_chunks(vector, integer, real) TO service_role;

GRANT ALL ON public.indexed_document_chunks TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indexed_document_chunks TO authenticated;
