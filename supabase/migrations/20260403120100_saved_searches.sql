-- Per-user saved search configurations (tenant-scoped, RLS). Idempotent.

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_searches_name_len CHECK (char_length(name) <= 200),
  CONSTRAINT saved_searches_query_len CHECK (char_length(query) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_company_user
  ON public.saved_searches (company_id, user_id, created_at DESC);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_searches_select ON public.saved_searches;
CREATE POLICY saved_searches_select ON public.saved_searches
  FOR SELECT USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS saved_searches_insert ON public.saved_searches;
CREATE POLICY saved_searches_insert ON public.saved_searches
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS saved_searches_update ON public.saved_searches;
CREATE POLICY saved_searches_update ON public.saved_searches
  FOR UPDATE USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS saved_searches_delete ON public.saved_searches;
CREATE POLICY saved_searches_delete ON public.saved_searches
  FOR DELETE USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

GRANT ALL ON public.saved_searches TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
