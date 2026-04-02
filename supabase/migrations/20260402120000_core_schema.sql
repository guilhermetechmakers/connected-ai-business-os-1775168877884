-- Connected AI Business OS — core multi-tenant schema (idempotent)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Companies (tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  currency text NOT NULL DEFAULT 'USD',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  email text,
  display_name text,
  roles text[] NOT NULL DEFAULT '{}',
  auth_methods text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  lead_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.unified_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  source_provider text NOT NULL,
  external_id text,
  text_content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  cached_value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles (company_id);
CREATE INDEX IF NOT EXISTS idx_departments_company ON public.departments (company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_company ON public.integrations (company_id);
CREATE INDEX IF NOT EXISTS idx_unified_entities_company ON public.unified_entities (company_id);
CREATE INDEX IF NOT EXISTS idx_workflows_company ON public.workflows (company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs (workflow_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents (company_id);
CREATE INDEX IF NOT EXISTS idx_kpis_company ON public.kpis (company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_company ON public.ai_conversations (company_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Helper: current user's company
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- RLS: tenant isolation via profiles.company_id = row.company_id
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT USING (id = public.current_company_id());

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
  FOR UPDATE USING (id = public.current_company_id());

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (id = auth.uid() OR company_id = public.current_company_id());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS departments_all ON public.departments;
CREATE POLICY departments_all ON public.departments
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS roles_all ON public.roles;
CREATE POLICY roles_all ON public.roles
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS integrations_all ON public.integrations;
CREATE POLICY integrations_all ON public.integrations
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS unified_entities_all ON public.unified_entities;
CREATE POLICY unified_entities_all ON public.unified_entities
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS workflows_all ON public.workflows;
CREATE POLICY workflows_all ON public.workflows
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS workflow_runs_all ON public.workflow_runs;
CREATE POLICY workflow_runs_all ON public.workflow_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_id AND w.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS documents_all ON public.documents;
CREATE POLICY documents_all ON public.documents
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS kpis_all ON public.kpis;
CREATE POLICY kpis_all ON public.kpis
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS activity_logs_all ON public.activity_logs;
CREATE POLICY activity_logs_all ON public.activity_logs
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS ai_conversations_all ON public.ai_conversations;
CREATE POLICY ai_conversations_all ON public.ai_conversations
  FOR ALL USING (company_id = public.current_company_id() AND user_id = auth.uid());
