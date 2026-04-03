-- AI Workspace: align prompt templates with Ask/Analyze/Report/Action modes + versioning (idempotent)

ALTER TABLE public.ai_prompt_templates
  ADD COLUMN IF NOT EXISTS workspace_mode text NOT NULL DEFAULT 'Ask'
    CHECK (workspace_mode IN ('Ask', 'Analyze', 'Report', 'Action'));

ALTER TABLE public.ai_prompt_templates
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_company_mode
  ON public.ai_prompt_templates (company_id, workspace_mode);

COMMENT ON COLUMN public.ai_prompt_templates.workspace_mode IS 'AI Workspace mode this template applies to';
COMMENT ON COLUMN public.ai_prompt_templates.version IS 'Template revision number for tenant library';
