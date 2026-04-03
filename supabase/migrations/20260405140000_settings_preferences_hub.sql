-- Settings / Preferences hub: company contact fields, branding, data policies,
-- tenant feature flags, settings audit trail, profile↔role assignments (idempotent).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.tenant_branding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  logo_url text NOT NULL DEFAULT '',
  primary_color text NOT NULL DEFAULT '#9AD0FF',
  secondary_color text NOT NULL DEFAULT '#154E78',
  font_preset text NOT NULL DEFAULT 'inter_poppins',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_data_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  retention_period_days integer NOT NULL DEFAULT 365 CHECK (retention_period_days >= 1 AND retention_period_days <= 36500),
  export_allowed boolean NOT NULL DEFAULT true,
  purge_scheduled boolean NOT NULL DEFAULT false,
  audit_retention_days integer NOT NULL DEFAULT 730 CHECK (audit_retention_days >= 30 AND audit_retention_days <= 36500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, feature_name)
);

CREATE TABLE IF NOT EXISTS public.tenant_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_role_assignments (
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_company ON public.tenant_branding_settings (company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_data_policies_company ON public.tenant_data_policies (company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_company ON public.tenant_feature_flags (company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_audit_company ON public.tenant_settings_audit (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_role_assignments_company ON public.profile_role_assignments (company_id);
CREATE INDEX IF NOT EXISTS idx_profile_role_assignments_profile ON public.profile_role_assignments (profile_id);

ALTER TABLE public.tenant_branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_data_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_role_assignments ENABLE ROW LEVEL SECURITY;

-- Client apps use Edge Functions (service role); block direct table access from anon/authenticated.
DROP POLICY IF EXISTS tenant_branding_settings_deny ON public.tenant_branding_settings;
CREATE POLICY tenant_branding_settings_deny ON public.tenant_branding_settings
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS tenant_data_policies_deny ON public.tenant_data_policies;
CREATE POLICY tenant_data_policies_deny ON public.tenant_data_policies
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS tenant_feature_flags_deny ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_deny ON public.tenant_feature_flags
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS tenant_settings_audit_deny ON public.tenant_settings_audit;
CREATE POLICY tenant_settings_audit_deny ON public.tenant_settings_audit
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS profile_role_assignments_deny ON public.profile_role_assignments;
CREATE POLICY profile_role_assignments_deny ON public.profile_role_assignments
  FOR ALL USING (false) WITH CHECK (false);
