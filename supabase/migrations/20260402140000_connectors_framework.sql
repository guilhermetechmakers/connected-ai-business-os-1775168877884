-- Integrations & Connectors framework (idempotent). Tenant = companies.id.

CREATE TABLE IF NOT EXISTS public.connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  display_name text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_hash text,
  status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  sync_interval_minutes integer NOT NULL DEFAULT 360,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider_key)
);

CREATE TABLE IF NOT EXISTS public.connector_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.connectors (id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id)
);

CREATE TABLE IF NOT EXISTS public.connector_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.connectors (id) ON DELETE CASCADE,
  source_field text NOT NULL,
  target_entity text NOT NULL,
  target_field text NOT NULL,
  data_type text NOT NULL DEFAULT 'string',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, source_field, target_entity, target_field)
);

CREATE TABLE IF NOT EXISTS public.connector_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.connectors (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_sync_idempotency
  ON public.connector_sync_runs (connector_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.connector_sync_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES public.connector_sync_runs (id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connectors_company ON public.connectors (company_id);
CREATE INDEX IF NOT EXISTS idx_connector_credentials_company ON public.connector_credentials (company_id);
CREATE INDEX IF NOT EXISTS idx_connector_mappings_company ON public.connector_field_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_company ON public.connector_sync_runs (company_id);
CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_connector ON public.connector_sync_runs (connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_sync_logs_run ON public.connector_sync_log_entries (sync_run_id);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_sync_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connectors_all ON public.connectors;
CREATE POLICY connectors_all ON public.connectors
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS connector_credentials_all ON public.connector_credentials;
CREATE POLICY connector_credentials_all ON public.connector_credentials
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS connector_field_mappings_all ON public.connector_field_mappings;
CREATE POLICY connector_field_mappings_all ON public.connector_field_mappings
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS connector_sync_runs_all ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_all ON public.connector_sync_runs
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS connector_sync_log_entries_all ON public.connector_sync_log_entries;
CREATE POLICY connector_sync_log_entries_all ON public.connector_sync_log_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.connector_sync_runs r
      WHERE r.id = sync_run_id AND r.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.connector_sync_runs r
      WHERE r.id = sync_run_id AND r.company_id = public.current_company_id()
    )
  );
