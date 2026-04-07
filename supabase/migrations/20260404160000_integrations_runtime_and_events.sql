-- Real integrations runtime state + provider event queue + Salesforce hard cleanup (idempotent)

-- 1) Hard-remove Salesforce connector footprint
DELETE FROM public.connector_sync_log_entries l
USING public.connector_sync_runs r, public.connectors c
WHERE l.sync_run_id = r.id
  AND r.connector_id = c.id
  AND c.provider_key = 'salesforce';

DELETE FROM public.connector_sync_runs r
USING public.connectors c
WHERE r.connector_id = c.id
  AND c.provider_key = 'salesforce';

DELETE FROM public.connector_field_mappings m
USING public.connectors c
WHERE m.connector_id = c.id
  AND c.provider_key = 'salesforce';

DELETE FROM public.connector_credentials cc
USING public.connectors c
WHERE cc.connector_id = c.id
  AND c.provider_key = 'salesforce';

DELETE FROM public.connectors
WHERE provider_key = 'salesforce';

DELETE FROM public.integrations
WHERE provider = 'salesforce';

-- 2) Connector runtime state (oauth state, cursors, provider checkpoints)
CREATE TABLE IF NOT EXISTS public.connector_runtime_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.connectors (id) ON DELETE CASCADE,
  state_key text NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, state_key)
);

CREATE INDEX IF NOT EXISTS idx_connector_runtime_state_company
  ON public.connector_runtime_state (company_id, connector_id);

ALTER TABLE public.connector_runtime_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_runtime_state_all ON public.connector_runtime_state;
CREATE POLICY connector_runtime_state_all ON public.connector_runtime_state
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- 3) Normalized provider event queue for workflow triggers
CREATE TABLE IF NOT EXISTS public.connector_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connector_id uuid REFERENCES public.connectors (id) ON DELETE SET NULL,
  provider_key text NOT NULL,
  event_type text NOT NULL,
  external_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider_key, event_type, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_connector_event_queue_pending
  ON public.connector_event_queue (company_id, status, available_at);

CREATE INDEX IF NOT EXISTS idx_connector_event_queue_provider
  ON public.connector_event_queue (company_id, provider_key, event_type, created_at DESC);

ALTER TABLE public.connector_event_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_event_queue_all ON public.connector_event_queue;
CREATE POLICY connector_event_queue_all ON public.connector_event_queue
  FOR ALL USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

-- Cleanup in case runtime/event tables already existed before this migration.
DELETE FROM public.connector_runtime_state rs
USING public.connectors c
WHERE rs.connector_id = c.id
  AND c.provider_key = 'salesforce';

DELETE FROM public.connector_event_queue
WHERE provider_key = 'salesforce';

-- 4) Useful comments
COMMENT ON TABLE public.connector_runtime_state IS 'Tenant-scoped connector runtime state (oauth handshake, sync cursors, provider checkpoints).';
COMMENT ON TABLE public.connector_event_queue IS 'Normalized provider events consumed by workflow trigger engine.';
