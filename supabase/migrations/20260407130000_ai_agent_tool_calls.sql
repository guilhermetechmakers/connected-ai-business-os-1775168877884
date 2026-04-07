-- AI Agent Tool Calls — audit table for every tool invocation made by the agent
-- Tracks what tools were called, with what args, and what the result was.

CREATE TABLE IF NOT EXISTS public.ai_agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  tool_call_id text,                  -- OpenAI tool_call.id
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text,
  iteration integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_company_created
  ON public.ai_agent_tool_calls (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_conversation
  ON public.ai_agent_tool_calls (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.ai_agent_tool_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_tool_calls_tenant ON public.ai_agent_tool_calls;
CREATE POLICY ai_tool_calls_tenant ON public.ai_agent_tool_calls
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
