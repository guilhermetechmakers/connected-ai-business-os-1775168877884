-- Unified data layer: sources, links, versioning, reports, dashboard rollups (idempotent)

-- Extend unified_entities
ALTER TABLE public.unified_entities
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.unified_entities
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.unified_entities
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;
ALTER TABLE public.unified_entities
  ADD COLUMN IF NOT EXISTS linked_entity_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_unified_entities_company_type_active
  ON public.unified_entities (company_id, entity_type)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_unified_entities_company_dept_active
  ON public.unified_entities (company_id, department_id)
  WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_unified_entities_payload_gin
  ON public.unified_entities USING gin (payload jsonb_path_ops);

-- Normalized source pointers (mirrors / augments source_references JSON)
CREATE TABLE IF NOT EXISTS public.unified_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_entity_id uuid NOT NULL REFERENCES public.unified_entities (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unified_entity_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_sources_company ON public.unified_sources (company_id);
CREATE INDEX IF NOT EXISTS idx_unified_sources_external ON public.unified_sources (company_id, provider, external_id);

-- Cross-entity relationships
CREATE TABLE IF NOT EXISTS public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  left_entity_id uuid NOT NULL REFERENCES public.unified_entities (id) ON DELETE CASCADE,
  right_entity_id uuid NOT NULL REFERENCES public.unified_entities (id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (left_entity_id, right_entity_id, relation_type),
  CHECK (left_entity_id <> right_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_company ON public.entity_links (company_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_left ON public.entity_links (left_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_right ON public.entity_links (right_entity_id);

-- Version / audit snapshots per mutation
CREATE TABLE IF NOT EXISTS public.unified_entity_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_entity_id uuid NOT NULL REFERENCES public.unified_entities (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unified_entity_versions_entity ON public.unified_entity_versions (unified_entity_id);

-- Report templates & schedules
CREATE TABLE IF NOT EXISTS public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  report_template_id uuid NOT NULL REFERENCES public.report_templates (id) ON DELETE CASCADE,
  cron_expression text,
  export_format text NOT NULL DEFAULT 'pdf',
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_company ON public.report_templates (company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_company ON public.report_schedules (company_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_template ON public.report_schedules (report_template_id);

-- RLS-safe rollup view (PostgreSQL 15+ uses security invoker by default for new views)
CREATE OR REPLACE VIEW public.v_dashboard_entity_rollups AS
SELECT
  company_id,
  entity_type,
  count(*)::bigint AS active_count
FROM public.unified_entities
WHERE is_deleted = false
GROUP BY company_id, entity_type;

-- Materialized snapshot for fast reads (refresh via Edge Function / cron; filter by company_id in app)
DROP MATERIALIZED VIEW IF EXISTS public.mv_tenant_dashboard_kpis;
CREATE MATERIALIZED VIEW public.mv_tenant_dashboard_kpis AS
SELECT
  company_id,
  entity_type,
  count(*) FILTER (WHERE is_deleted = false) AS active_count,
  max(updated_at) AS last_activity_at
FROM public.unified_entities
GROUP BY company_id, entity_type;

CREATE UNIQUE INDEX IF NOT EXISTS mv_tenant_dashboard_kpis_uidx
  ON public.mv_tenant_dashboard_kpis (company_id, entity_type);

ALTER TABLE public.unified_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_entity_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unified_sources_all ON public.unified_sources;
CREATE POLICY unified_sources_all ON public.unified_sources
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS entity_links_all ON public.entity_links;
CREATE POLICY entity_links_all ON public.entity_links
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS unified_entity_versions_select ON public.unified_entity_versions;
CREATE POLICY unified_entity_versions_select ON public.unified_entity_versions
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS unified_entity_versions_insert ON public.unified_entity_versions;
CREATE POLICY unified_entity_versions_insert ON public.unified_entity_versions
  FOR INSERT WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS report_templates_all ON public.report_templates;
CREATE POLICY report_templates_all ON public.report_templates
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS report_schedules_all ON public.report_schedules;
CREATE POLICY report_schedules_all ON public.report_schedules
  FOR ALL USING (company_id = public.current_company_id());

GRANT SELECT ON public.v_dashboard_entity_rollups TO authenticated;
GRANT SELECT ON public.v_dashboard_entity_rollups TO service_role;

-- Service role typically has MV access; do not grant MV to authenticated (tenant filter enforced in Edge Function)
GRANT SELECT ON public.mv_tenant_dashboard_kpis TO service_role;

-- Permission-aware search over unified entities (RLS + tenant via current_company_id)
CREATE OR REPLACE FUNCTION public.search_unified_entities(
  p_search text,
  p_entity_type text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.unified_entities
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.unified_entities e
  WHERE e.company_id = public.current_company_id()
    AND e.is_deleted = false
    AND (p_entity_type IS NULL OR p_entity_type = '' OR e.entity_type = p_entity_type)
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (
      p_search IS NULL OR trim(p_search) = '' OR
      e.entity_type ILIKE '%' || p_search || '%' OR
      e.payload::text ILIKE '%' || p_search || '%'
    )
  ORDER BY e.updated_at DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 200);
$$;

REVOKE ALL ON FUNCTION public.search_unified_entities(text, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_unified_entities(text, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_unified_entities(text, text, uuid, integer) TO service_role;

-- Refresh materialized KPI snapshot (Edge / cron with service role only)
CREATE OR REPLACE FUNCTION public.refresh_dashboard_kpis_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_dashboard_kpis;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dashboard_kpis_mv() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_kpis_mv() TO service_role;
