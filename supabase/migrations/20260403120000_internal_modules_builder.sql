-- Internal Module / Template Builder — tenant-scoped modules, versions, JSON permissions, marketplace (idempotent)

CREATE TABLE IF NOT EXISTS public.module_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  slug text NOT NULL DEFAULT '',
  name text NOT NULL,
  description text,
  preview_ui text NOT NULL DEFAULT '',
  default_ui_entry text NOT NULL DEFAULT '/dashboard/modules/preview',
  bindings_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_templates_company ON public.module_templates (company_id);

CREATE TABLE IF NOT EXISTS public.internal_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  ui_entry text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  tenant_scope jsonb NOT NULL DEFAULT '["current_tenant"]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  data_bindings jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_status text NOT NULL DEFAULT 'unknown',
  last_deployed_at timestamptz,
  marketplace_template_id uuid REFERENCES public.module_templates (id) ON DELETE SET NULL,
  installed_from_template boolean NOT NULL DEFAULT false,
  active_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_modules_status_chk CHECK (
    status IN ('draft', 'published', 'deprecated', 'archived', 'Draft', 'Published', 'Deprecated', 'Archived')
  ),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_internal_modules_company ON public.internal_modules (company_id);
CREATE INDEX IF NOT EXISTS idx_internal_modules_status ON public.internal_modules (company_id, status);
CREATE INDEX IF NOT EXISTS idx_internal_modules_tags ON public.internal_modules USING gin (tags);

CREATE TABLE IF NOT EXISTS public.module_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.internal_modules (id) ON DELETE CASCADE,
  version_tag text NOT NULL,
  changelog text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  migration_notes text,
  binding_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_versions_module ON public.module_versions (module_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.module_department_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.internal_modules (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'read',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_module_department_access_module ON public.module_department_access (module_id);

ALTER TABLE public.module_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_department_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_templates_select ON public.module_templates;
CREATE POLICY module_templates_select ON public.module_templates
  FOR SELECT
  USING (company_id IS NULL OR company_id = public.current_company_id());

DROP POLICY IF EXISTS module_templates_insert ON public.module_templates;
CREATE POLICY module_templates_insert ON public.module_templates
  FOR INSERT
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS module_templates_update ON public.module_templates;
CREATE POLICY module_templates_update ON public.module_templates
  FOR UPDATE
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS internal_modules_all ON public.internal_modules;
CREATE POLICY internal_modules_all ON public.internal_modules
  FOR ALL
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS module_versions_all ON public.module_versions;
CREATE POLICY module_versions_all ON public.module_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_modules m
      WHERE m.id = module_id AND m.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internal_modules m
      WHERE m.id = module_id AND m.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS module_department_access_all ON public.module_department_access;
CREATE POLICY module_department_access_all ON public.module_department_access
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_modules m
      WHERE m.id = module_id AND m.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.internal_modules m
      WHERE m.id = module_id AND m.company_id = public.current_company_id()
    )
  );

INSERT INTO public.module_templates (
  id, company_id, slug, name, description, preview_ui, default_ui_entry, bindings_template, dependencies
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    NULL,
    'deal-desk',
    'Deal desk',
    'Pipeline hygiene, stage gates, and CRM sync summaries.',
    'deal-desk-preview',
    '/dashboard/modules/preview',
    '[{"bindingName":"primary","sourceContext":"unified_entities","targetEntity":"deal","fieldMappings":{"stage":"payload.stage","amount":"payload.amount"}}]'::jsonb,
    '["crm-connector"]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000002'::uuid,
    NULL,
    'cs-health',
    'CS health',
    'Account health scores and renewal risk from unified context.',
    'cs-health-preview',
    '/dashboard/modules/preview',
    '[{"bindingName":"accounts","sourceContext":"unified_entities","targetEntity":"account","fieldMappings":{"health":"payload.health_score"}}]'::jsonb,
    '[]'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000003'::uuid,
    NULL,
    'hiring-ops',
    'Hiring ops',
    'Requisition and interview pipeline mini-app.',
    'hiring-ops-preview',
    '/dashboard/modules/preview',
    '[{"bindingName":"reqs","sourceContext":"unified_entities","targetEntity":"requisition","fieldMappings":{"status":"payload.status"}}]'::jsonb,
    '["ats-connector"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
