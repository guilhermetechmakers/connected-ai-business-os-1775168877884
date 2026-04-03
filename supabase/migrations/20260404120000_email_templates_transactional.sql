-- Tenant-scoped transactional email template overrides (verification, onboarding, reports, alerts).

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  template_key text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  placeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_templates_company_key UNIQUE (company_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_company ON public.email_templates (company_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_tenant_rw ON public.email_templates;
CREATE POLICY email_templates_tenant_rw ON public.email_templates
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
