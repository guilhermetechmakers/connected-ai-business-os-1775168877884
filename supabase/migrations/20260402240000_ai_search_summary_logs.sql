-- Audit trail for AI-assisted global search summaries (idempotent).

CREATE TABLE IF NOT EXISTS public.ai_search_summary_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  context_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  confidence numeric(6, 4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_search_summary_logs_company ON public.ai_search_summary_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_search_summary_logs_user ON public.ai_search_summary_logs (user_id, created_at DESC);

ALTER TABLE public.ai_search_summary_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_search_summary_logs_select ON public.ai_search_summary_logs;
CREATE POLICY ai_search_summary_logs_select ON public.ai_search_summary_logs
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS ai_search_summary_logs_insert ON public.ai_search_summary_logs;
CREATE POLICY ai_search_summary_logs_insert ON public.ai_search_summary_logs
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

GRANT ALL ON public.ai_search_summary_logs TO postgres, service_role;
GRANT SELECT, INSERT ON public.ai_search_summary_logs TO authenticated;
