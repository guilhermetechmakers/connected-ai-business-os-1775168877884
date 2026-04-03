-- Dashboard framework: widget registry, per-user layouts, instances, export schedules, audit (idempotent)

-- ---------------------------------------------------------------------------
-- Widget definitions (global catalog: company_id NULL; tenant extensions: company_id set)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_widget_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility_rules jsonb NOT NULL DEFAULT '{"roles":[]}'::jsonb,
  data_adapter_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_widget_defs_company_type
  ON public.dashboard_widget_definitions (company_id, type)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_dashboard_widget_defs_company
  ON public.dashboard_widget_definitions (company_id)
  WHERE company_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Per-user dashboard layouts (grid JSON + metadata)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  dashboard_kind text NOT NULL CHECK (dashboard_kind IN ('global', 'executive')),
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, dashboard_kind, name)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_company_user
  ON public.dashboard_layouts (company_id, user_id);

-- ---------------------------------------------------------------------------
-- Widget instances (id aligns with react-grid-layout item "i" when UUID)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_widget_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.dashboard_layouts (id) ON DELETE CASCADE,
  widget_definition_id uuid REFERENCES public.dashboard_widget_definitions (id) ON DELETE SET NULL,
  widget_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widget_instances_layout
  ON public.dashboard_widget_instances (layout_id);

-- ---------------------------------------------------------------------------
-- Export / schedule delivery targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_export_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  layout_id uuid REFERENCES public.dashboard_layouts (id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('email', 'webhook')),
  target_value text NOT NULL,
  cron_expression text NOT NULL DEFAULT '0 9 * * 1',
  last_run_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_export_schedules_company_user
  ON public.dashboard_export_schedules (company_id, user_id);

-- ---------------------------------------------------------------------------
-- Audit events for dashboard mutations (tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_audit_company_created
  ON public.dashboard_audit_events (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed global widget definitions (idempotent inserts by type)
-- ---------------------------------------------------------------------------
INSERT INTO public.dashboard_widget_definitions (company_id, name, type, default_config, visibility_rules, data_adapter_key)
SELECT NULL, v.name, v.type, v.default_config::jsonb, v.visibility_rules::jsonb, v.data_adapter_key
FROM (VALUES
  ('KPI overview', 'kpi_strip', '{}', '{"roles":[]}', 'rollups'),
  ('Throughput chart', 'throughput_chart', '{}', '{"roles":[]}', 'throughput_sample'),
  ('AI insight strip', 'ai_insight', '{}', '{"roles":[]}', 'ai_insight'),
  ('AI governance', 'ai_governance', '{}', '{"roles":[]}', 'ai_governance'),
  ('Activity stream', 'activity_stream', '{}', '{"roles":[]}', 'activity_feed'),
  ('Alerts', 'alerts_feed', '{}', '{"roles":[]}', 'alerts_feed'),
  ('Quick actions', 'quick_actions', '{}', '{"roles":[]}', 'quick_actions'),
  ('Global search', 'global_search_card', '{}', '{"roles":[]}', 'none'),
  ('Executive metrics', 'exec_metrics', '{}', '{"roles":["admin","executive","manager","company admin"]}', 'exec_metrics'),
  ('Risk scoreboard', 'risk_pie', '{}', '{"roles":["admin","executive","manager","company admin"]}', 'risk_sample'),
  ('Department heatmap', 'dept_heatmap', '{}', '{"roles":["admin","executive","manager","company admin"]}', 'departments_rollup'),
  ('Executive AI brief', 'exec_ai_brief', '{}', '{"roles":["admin","executive","company admin"]}', 'executive_brief')
) AS v(name, type, default_config, visibility_rules, data_adapter_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dashboard_widget_definitions d
  WHERE d.company_id IS NULL AND d.type = v.type
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.dashboard_widget_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widget_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_export_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_widget_definitions_select ON public.dashboard_widget_definitions;
CREATE POLICY dashboard_widget_definitions_select ON public.dashboard_widget_definitions
  FOR SELECT
  USING (
    company_id IS NULL
    OR company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS dashboard_widget_definitions_mutate ON public.dashboard_widget_definitions;
CREATE POLICY dashboard_widget_definitions_mutate ON public.dashboard_widget_definitions
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS dashboard_layouts_all_own ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_all_own ON public.dashboard_layouts
  FOR ALL
  USING (company_id = public.current_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS dashboard_widget_instances_all ON public.dashboard_widget_instances;
CREATE POLICY dashboard_widget_instances_all ON public.dashboard_widget_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_layouts l
      WHERE l.id = layout_id
        AND l.company_id = public.current_company_id()
        AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dashboard_layouts l
      WHERE l.id = layout_id
        AND l.company_id = public.current_company_id()
        AND l.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dashboard_export_schedules_all_own ON public.dashboard_export_schedules;
CREATE POLICY dashboard_export_schedules_all_own ON public.dashboard_export_schedules
  FOR ALL
  USING (company_id = public.current_company_id() AND user_id = auth.uid())
  WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS dashboard_audit_select ON public.dashboard_audit_events;
CREATE POLICY dashboard_audit_select ON public.dashboard_audit_events
  FOR SELECT
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS dashboard_audit_insert ON public.dashboard_audit_events;
CREATE POLICY dashboard_audit_insert ON public.dashboard_audit_events
  FOR INSERT
  WITH CHECK (company_id = public.current_company_id());
