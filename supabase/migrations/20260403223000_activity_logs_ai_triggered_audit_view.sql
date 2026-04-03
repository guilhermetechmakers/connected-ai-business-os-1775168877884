-- Generated flag for AI-attributed activity rows + forensic audit view (idempotent)

-- ---------------------------------------------------------------------------
-- ai_triggered: derived from linked AI action (no client writes required)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'ai_triggered'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD COLUMN ai_triggered boolean GENERATED ALWAYS AS (ai_action_id IS NOT NULL) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_ai_triggered
  ON public.activity_logs (company_id, ai_triggered)
  WHERE ai_triggered;

-- ---------------------------------------------------------------------------
-- Compliance-oriented slice (RLS follows underlying activity_logs for invoker)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.audit_trail_forensic AS
SELECT
  al.id,
  al.company_id AS tenant_id,
  al.actor_user_id AS user_id,
  al.event_type AS action,
  COALESCE(al.related_entity, 'activity') AS resource,
  al.payload AS metadata,
  al.created_at,
  al.ai_triggered
FROM public.activity_logs al
WHERE al.event_type IN (
  'admin_action',
  'ai_action',
  'workflow_run',
  'integration_sync',
  'connector.sync',
  'system_change'
);

COMMENT ON VIEW public.audit_trail_forensic IS
  'High-signal audit events for admin console forensic view; obeys activity_logs RLS when queried as invoker.';
