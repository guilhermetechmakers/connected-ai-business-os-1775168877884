-- Multi-tenant company module: tenant lifecycle fields, configs, onboarding templates, flags rollout, integration sync metadata (idempotent)

-- ---------------------------------------------------------------------------
-- Companies (tenant) lifecycle & billing linkage
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'us';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tenant_status text NOT NULL DEFAULT 'active'
  CHECK (tenant_status IN ('active', 'suspended', 'deprovisioned', 'provisioning'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS billing_id text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_name text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_tenant_status ON public.companies (tenant_status);
CREATE INDEX IF NOT EXISTS idx_companies_region_plan ON public.companies (region, plan);

-- ---------------------------------------------------------------------------
-- Per-tenant key/value configuration (integrations/modules/feature hints)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_configs_company_key UNIQUE (company_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_configs_company ON public.tenant_configs (company_id);

ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_configs_tenant_all ON public.tenant_configs;
CREATE POLICY tenant_configs_tenant_all ON public.tenant_configs
  FOR ALL
  USING (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Onboarding / environment templates (global or tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'onboarding' CHECK (template_type IN ('onboarding', 'system')),
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_tenant ON public.onboarding_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_type ON public.onboarding_templates (template_type);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_templates_select ON public.onboarding_templates;
CREATE POLICY onboarding_templates_select ON public.onboarding_templates
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.roles @> ARRAY['super_admin']::text[]
    )
  );

DROP POLICY IF EXISTS onboarding_templates_super_mutate ON public.onboarding_templates;
CREATE POLICY onboarding_templates_super_mutate ON public.onboarding_templates
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
-- Feature flags: gradual rollout percentage
-- ---------------------------------------------------------------------------
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS rollout integer NOT NULL DEFAULT 100
  CHECK (rollout >= 0 AND rollout <= 100);

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Legacy integrations table: sync observability
-- ---------------------------------------------------------------------------
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS error_message text;
