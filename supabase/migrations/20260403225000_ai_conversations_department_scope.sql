-- Department-scoped AI conversations (tenant isolation + optional department filter for RAG / audit)

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_company_department
  ON public.ai_conversations (company_id, department_id)
  WHERE department_id IS NOT NULL;
