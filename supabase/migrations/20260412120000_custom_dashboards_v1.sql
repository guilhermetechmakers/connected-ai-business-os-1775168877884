-- Custom dashboards v1: AI-generated React code, saved runtime metadata,
-- role-shared visibility, and refresh/generation run audit trail.

-- ---------------------------------------------------------------------------
-- Role helpers used by RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_roles_normalized()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profile_roles AS (
    SELECT unnest(coalesce(p.roles, '{}'::text[])) AS role_name
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = public.current_company_id()
  ),
  assigned_roles AS (
    SELECT r.name AS role_name
    FROM public.profile_role_assignments pra
    JOIN public.roles r ON r.id = pra.role_id
    WHERE pra.profile_id = auth.uid()
      AND r.company_id = public.current_company_id()
  )
  SELECT coalesce(
    array_agg(DISTINCT lower(trim(x.role_name))) FILTER (
      WHERE x.role_name IS NOT NULL AND length(trim(x.role_name)) > 0
    ),
    '{}'::text[]
  )
  FROM (
    SELECT role_name FROM profile_roles
    UNION ALL
    SELECT role_name FROM assigned_roles
  ) AS x;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_roles_normalized() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_roles_normalized() TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_custom_dashboard(
  p_creator_user_id uuid,
  p_visibility_mode text,
  p_shared_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_creator_user_id = auth.uid()
    OR p_visibility_mode = 'company'
    OR (
      p_visibility_mode = 'roles'
      AND coalesce(p_shared_roles, '{}'::text[]) && public.current_user_roles_normalized()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_custom_dashboard(uuid, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_custom_dashboard(uuid, text, text[]) TO service_role;

-- ---------------------------------------------------------------------------
-- Saved custom dashboards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  code_tsx text NOT NULL,
  query_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility_mode text NOT NULL DEFAULT 'roles' CHECK (visibility_mode IN ('private', 'roles', 'company')),
  shared_roles text[] NOT NULL DEFAULT '{}'::text[],
  integration_sources text[] NOT NULL DEFAULT '{}'::text[],
  latest_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_dashboards_company_updated
  ON public.custom_dashboards (company_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_dashboards_creator
  ON public.custom_dashboards (creator_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_dashboards_visibility_roles
  ON public.custom_dashboards USING gin (shared_roles);

ALTER TABLE public.custom_dashboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_dashboards_select_access ON public.custom_dashboards;
CREATE POLICY custom_dashboards_select_access ON public.custom_dashboards
  FOR SELECT
  USING (
    company_id = public.current_company_id()
    AND public.can_access_custom_dashboard(creator_user_id, visibility_mode, shared_roles)
  );

DROP POLICY IF EXISTS custom_dashboards_insert_own ON public.custom_dashboards;
CREATE POLICY custom_dashboards_insert_own ON public.custom_dashboards
  FOR INSERT
  WITH CHECK (
    company_id = public.current_company_id()
    AND creator_user_id = auth.uid()
  );

DROP POLICY IF EXISTS custom_dashboards_update_creator ON public.custom_dashboards;
CREATE POLICY custom_dashboards_update_creator ON public.custom_dashboards
  FOR UPDATE
  USING (
    company_id = public.current_company_id()
    AND creator_user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND creator_user_id = auth.uid()
  );

DROP POLICY IF EXISTS custom_dashboards_delete_creator ON public.custom_dashboards;
CREATE POLICY custom_dashboards_delete_creator ON public.custom_dashboards
  FOR DELETE
  USING (
    company_id = public.current_company_id()
    AND creator_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Custom dashboard generation / refresh run log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_dashboard_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  dashboard_id uuid REFERENCES public.custom_dashboards (id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('generation', 'refresh')),
  status text NOT NULL CHECK (status IN ('succeeded', 'failed')),
  query_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  integration_sources text[] NOT NULL DEFAULT '{}'::text[],
  error_message text,
  execution_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_dashboard_runs_company_created
  ON public.custom_dashboard_runs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_dashboard_runs_dashboard_created
  ON public.custom_dashboard_runs (dashboard_id, created_at DESC);

ALTER TABLE public.custom_dashboard_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_dashboard_runs_select_access ON public.custom_dashboard_runs;
CREATE POLICY custom_dashboard_runs_select_access ON public.custom_dashboard_runs
  FOR SELECT
  USING (
    company_id = public.current_company_id()
    AND (
      (dashboard_id IS NULL AND actor_user_id = auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.custom_dashboards d
        WHERE d.id = dashboard_id
          AND d.company_id = public.current_company_id()
          AND public.can_access_custom_dashboard(d.creator_user_id, d.visibility_mode, d.shared_roles)
      )
    )
  );

DROP POLICY IF EXISTS custom_dashboard_runs_insert_access ON public.custom_dashboard_runs;
CREATE POLICY custom_dashboard_runs_insert_access ON public.custom_dashboard_runs
  FOR INSERT
  WITH CHECK (
    company_id = public.current_company_id()
    AND actor_user_id = auth.uid()
    AND (
      dashboard_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.custom_dashboards d
        WHERE d.id = dashboard_id
          AND d.company_id = public.current_company_id()
          AND public.can_access_custom_dashboard(d.creator_user_id, d.visibility_mode, d.shared_roles)
      )
    )
  );

DROP POLICY IF EXISTS custom_dashboard_runs_update_own ON public.custom_dashboard_runs;
CREATE POLICY custom_dashboard_runs_update_own ON public.custom_dashboard_runs
  FOR UPDATE
  USING (company_id = public.current_company_id() AND actor_user_id = auth.uid())
  WITH CHECK (company_id = public.current_company_id() AND actor_user_id = auth.uid());

DROP POLICY IF EXISTS custom_dashboard_runs_delete_own ON public.custom_dashboard_runs;
CREATE POLICY custom_dashboard_runs_delete_own ON public.custom_dashboard_runs
  FOR DELETE
  USING (company_id = public.current_company_id() AND actor_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Feature flag bootstrap (disabled by default)
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_flags (flag_key, company_id, enabled, rollout, payload, updated_at)
SELECT 'custom_dashboards_v1', NULL, false, 100, '{}'::jsonb, now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.feature_flags f
  WHERE f.flag_key = 'custom_dashboards_v1'
    AND f.company_id IS NULL
);
