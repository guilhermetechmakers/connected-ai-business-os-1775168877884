-- AI Assistant & Agent Layer — normalized messages, templates, RAG chunks, telemetry, action audit (idempotent)

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'Ask',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL DEFAULT '',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_company ON public.ai_messages (company_id);

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  department text,
  purpose text NOT NULL DEFAULT 'general',
  name text NOT NULL,
  template_text text NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_company ON public.ai_prompt_templates (company_id);

CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_id uuid REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_company ON public.ai_action_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_user ON public.ai_action_logs (user_id);

CREATE TABLE IF NOT EXISTS public.ai_usage_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  conversation_id uuid REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_telemetry_company ON public.ai_usage_telemetry (company_id);

CREATE TABLE IF NOT EXISTS public.ai_context_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'global',
  source_type text NOT NULL,
  source_id text,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_context_chunks_company ON public.ai_context_chunks (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_chunks_workspace ON public.ai_context_chunks (company_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_context_chunks_fts ON public.ai_context_chunks
  USING gin (to_tsvector('english', coalesce(content, '')));

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_context_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_messages_select ON public.ai_messages;
CREATE POLICY ai_messages_select ON public.ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.company_id = public.current_company_id()
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_insert ON public.ai_messages;
CREATE POLICY ai_messages_insert ON public.ai_messages
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.company_id = public.current_company_id()
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_prompt_templates_all ON public.ai_prompt_templates;
CREATE POLICY ai_prompt_templates_all ON public.ai_prompt_templates
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS ai_action_logs_select ON public.ai_action_logs;
CREATE POLICY ai_action_logs_select ON public.ai_action_logs
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS ai_action_logs_insert ON public.ai_action_logs;
CREATE POLICY ai_action_logs_insert ON public.ai_action_logs
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS ai_usage_telemetry_select ON public.ai_usage_telemetry;
CREATE POLICY ai_usage_telemetry_select ON public.ai_usage_telemetry
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS ai_usage_telemetry_insert ON public.ai_usage_telemetry;
CREATE POLICY ai_usage_telemetry_insert ON public.ai_usage_telemetry
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS ai_context_chunks_all ON public.ai_context_chunks;
CREATE POLICY ai_context_chunks_all ON public.ai_context_chunks
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
