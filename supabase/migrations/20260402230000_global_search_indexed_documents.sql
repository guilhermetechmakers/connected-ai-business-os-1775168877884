-- Global search: tenant-scoped indexed documents (Drive, Notion, uploads) + index job telemetry (idempotent)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.indexed_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  source_provider text NOT NULL,
  external_id text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  full_text text,
  snippet text,
  embedding jsonb,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  permissions jsonb NOT NULL DEFAULT '{"scope":"tenant"}'::jsonb,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_indexed_documents_company ON public.indexed_documents (company_id);
CREATE INDEX IF NOT EXISTS idx_indexed_documents_company_title_trgm
  ON public.indexed_documents USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_indexed_documents_fulltext_trgm
  ON public.indexed_documents USING gin (COALESCE(full_text, '') gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.search_index_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ok',
  provider text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_index_jobs_company_created
  ON public.search_index_jobs (company_id, created_at DESC);

ALTER TABLE public.indexed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_index_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS indexed_documents_all ON public.indexed_documents;
CREATE POLICY indexed_documents_all ON public.indexed_documents
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS search_index_jobs_select ON public.search_index_jobs;
CREATE POLICY search_index_jobs_select ON public.search_index_jobs
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS search_index_jobs_insert ON public.search_index_jobs;
CREATE POLICY search_index_jobs_insert ON public.search_index_jobs
  FOR INSERT WITH CHECK (company_id = public.current_company_id());
