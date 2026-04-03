-- Settings / Preferences hub: data policies, settings audit, profile↔role assignments,
-- builder API keys (hashed), tenant admin feature-flag mutations, role descriptions.

-- ---------------------------------------------------------------------------
-- Tenant settings admin helper (RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_settings_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id IS NOT NULL
      AND (
        p.roles @> ARRAY['admin']::text[]
        OR p.roles @> ARRAY['tenant_admin']::text[]
        OR p.roles @> ARRAY['owner']::text[]
        OR p.roles @> ARRAY['super_admin']::text[]
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Roles: optional description for RBAC UI
-- ---------------------------------------------------------------------------
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Per-tenant data retention / export policy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_data_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  retention_period_days integer NOT NULL DEFAULT 365 CHECK (retention_period_days >= 0),
  export_allowed boolean NOT NULL DEFAULT true,
  purge_scheduled boolean NOT NULL DEFAULT false,
  audit_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_data_policies_company_unique UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_data_policies_company
  ON public.tenant_data_policies (company_id);

ALTER TABLE public.tenant_data_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_data_policies_select ON public.tenant_data_policies;
CREATE POLICY tenant_data_policies_select ON public.tenant_data_policies
  FOR SELECT
  USING (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS tenant_data_policies_mutate ON public.tenant_data_policies;
CREATE POLICY tenant_data_policies_mutate ON public.tenant_data_policies
  FOR ALL
  USING (
    company_id = public.current_company_id()
    AND public.is_tenant_settings_admin()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.is_tenant_settings_admin()
  );

-- ---------------------------------------------------------------------------
-- Settings change audit (tenant-scoped, distinct from generic activity_logs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settings_audit_log_company_created
  ON public.settings_audit_log (company_id, created_at DESC);

ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_audit_log_select ON public.settings_audit_log;
CREATE POLICY settings_audit_log_select ON public.settings_audit_log
  FOR SELECT
  USING (
    (
      company_id = public.current_company_id()
      AND public.is_tenant_settings_admin()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS settings_audit_log_insert ON public.settings_audit_log;
CREATE POLICY settings_audit_log_insert ON public.settings_audit_log
  FOR INSERT
  WITH CHECK (
    company_id = public.current_company_id()
    AND (
      public.is_tenant_settings_admin()
      OR actor_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Profile ↔ canonical Role assignments (supplements profiles.roles text[])
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_role_assignments (
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_role_assignments_profile
  ON public.profile_role_assignments (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_role_assignments_role
  ON public.profile_role_assignments (role_id);

ALTER TABLE public.profile_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_role_assignments_select ON public.profile_role_assignments;
CREATE POLICY profile_role_assignments_select ON public.profile_role_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.company_id = public.current_company_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS profile_role_assignments_mutate ON public.profile_role_assignments;
CREATE POLICY profile_role_assignments_mutate ON public.profile_role_assignments
  FOR ALL
  USING (
    public.is_tenant_settings_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = role_id
      WHERE p.id = profile_id
        AND p.company_id = public.current_company_id()
        AND r.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    public.is_tenant_settings_admin()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = role_id
      WHERE p.id = profile_id
        AND p.company_id = public.current_company_id()
        AND r.company_id = public.current_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Builder / integration API keys (secret shown once; stored as hash only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.builder_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'API key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_builder_api_keys_company ON public.builder_api_keys (company_id);
CREATE INDEX IF NOT EXISTS idx_builder_api_keys_profile ON public.builder_api_keys (profile_id);

ALTER TABLE public.builder_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS builder_api_keys_select ON public.builder_api_keys;
CREATE POLICY builder_api_keys_select ON public.builder_api_keys
  FOR SELECT
  USING (
    (
      company_id = public.current_company_id()
      AND (
        profile_id = auth.uid()
        OR public.is_tenant_settings_admin()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS builder_api_keys_insert ON public.builder_api_keys;
CREATE POLICY builder_api_keys_insert ON public.builder_api_keys
  FOR INSERT
  WITH CHECK (
    company_id = public.current_company_id()
    AND profile_id = auth.uid()
  );

DROP POLICY IF EXISTS builder_api_keys_delete ON public.builder_api_keys;
CREATE POLICY builder_api_keys_delete ON public.builder_api_keys
  FOR DELETE
  USING (
    company_id = public.current_company_id()
    AND (
      profile_id = auth.uid()
      OR public.is_tenant_settings_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- Tenant-scoped feature flags: allow tenant admins to upsert their rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS feature_flags_tenant_admin_mutate ON public.feature_flags;
CREATE POLICY feature_flags_tenant_admin_mutate ON public.feature_flags
  FOR ALL
  USING (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND public.is_tenant_settings_admin()
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND company_id = public.current_company_id()
    AND public.is_tenant_settings_admin()
  );
