-- Activity log audit trail: extended schema, append-only RLS, retention, admin tables, search RPC

-- ---------------------------------------------------------------------------
-- Companies: configurable retention (pruning enforced by Edge Function cron)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS activity_log_retention_days integer NOT NULL DEFAULT 365;

-- ---------------------------------------------------------------------------
-- Activity logs: canonical linkage + redaction + metadata + search helper
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS workflow_run_id uuid REFERENCES public.workflow_runs (id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS connector_id uuid REFERENCES public.connectors (id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.integrations (id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS ai_action_id uuid REFERENCES public.ai_action_logs (id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS redacted_payload jsonb;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow_run
  ON public.activity_logs (company_id, workflow_run_id)
  WHERE workflow_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_connector
  ON public.activity_logs (company_id, connector_id)
  WHERE connector_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_ai_action
  ON public.activity_logs (company_id, ai_action_id)
  WHERE ai_action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_brin
  ON public.activity_logs USING brin (created_at);

-- ---------------------------------------------------------------------------
-- Append-only semantics: replace broad FOR ALL policy with SELECT + INSERT only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS activity_logs_all ON public.activity_logs;

CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT
  USING (company_id = public.current_company_id());

CREATE POLICY activity_logs_insert ON public.activity_logs
  FOR INSERT
  WITH CHECK (company_id = public.current_company_id());

-- ---------------------------------------------------------------------------
-- Tenant-scoped search (SECURITY INVOKER → RLS applies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_activity_logs(
  p_company_id uuid,
  p_query text,
  p_event_types text[] DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_workflow_run_id uuid DEFAULT NULL,
  p_connector_id uuid DEFAULT NULL,
  p_ai_action_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.activity_logs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.activity_logs al
  WHERE al.company_id = p_company_id
    AND (p_event_types IS NULL OR cardinality(p_event_types) = 0 OR al.event_type = ANY (p_event_types))
    AND (p_actor_user_id IS NULL OR al.actor_user_id = p_actor_user_id)
    AND (p_workflow_run_id IS NULL OR al.workflow_run_id = p_workflow_run_id)
    AND (p_connector_id IS NULL OR al.connector_id = p_connector_id)
    AND (p_ai_action_id IS NULL OR al.ai_action_id = p_ai_action_id)
    AND (p_date_from IS NULL OR al.created_at >= p_date_from)
    AND (p_date_to IS NULL OR al.created_at <= p_date_to)
    AND (
      p_query IS NULL OR length(trim(p_query)) = 0 OR
      al.event_type ILIKE '%' || trim(p_query) || '%' OR
      al.payload::text ILIKE '%' || trim(p_query) || '%' OR
      al.metadata::text ILIKE '%' || trim(p_query) || '%' OR
      (al.redacted_payload IS NOT NULL AND al.redacted_payload::text ILIKE '%' || trim(p_query) || '%')
    )
  ORDER BY al.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 200)
  OFFSET GREATEST(coalesce(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.match_activity_logs(
  uuid, text, text[], uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.match_activity_logs(
  uuid, text, text[], uuid, uuid, uuid, uuid, timestamptz, timestamptz, integer, integer
) TO service_role;

-- ---------------------------------------------------------------------------
-- Platform templates (managed via Edge Function + service role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'module',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_templates_key_unique UNIQUE (template_key)
);

CREATE INDEX IF NOT EXISTS idx_system_templates_category ON public.system_templates (category);

ALTER TABLE public.system_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_templates_super_select ON public.system_templates;
CREATE POLICY system_templates_super_select ON public.system_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS system_templates_super_all ON public.system_templates;
CREATE POLICY system_templates_super_all ON public.system_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Feature flags: global (company_id NULL) or per-tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL,
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_key_scope UNIQUE (flag_key, company_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON public.feature_flags (company_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags (flag_key);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_tenant_select ON public.feature_flags;
CREATE POLICY feature_flags_tenant_select ON public.feature_flags
  FOR SELECT
  USING (
    company_id IS NULL
    OR company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS feature_flags_super_mutate ON public.feature_flags;
CREATE POLICY feature_flags_super_mutate ON public.feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );
