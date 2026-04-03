-- Department workspace scoping: workflows + AI conversations linked to departments (idempotent)

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_company_department
  ON public.workflows (company_id, department_id);

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_department
  ON public.ai_conversations (company_id, department_id);
