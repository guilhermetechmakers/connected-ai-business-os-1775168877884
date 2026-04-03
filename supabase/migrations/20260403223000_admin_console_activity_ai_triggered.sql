-- Admin console: explicit AI-triggered flag on activity logs for cross-tenant filters
-- Idempotent: safe to re-apply

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS ai_triggered boolean NOT NULL DEFAULT false;

UPDATE public.activity_logs
SET ai_triggered = true
WHERE ai_triggered = false
  AND (
    ai_action_id IS NOT NULL
    OR event_type = 'ai_action'
  );

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_ai_triggered_created
  ON public.activity_logs (company_id, ai_triggered, created_at DESC);

-- Compliance-oriented audit view (read-only projection of activity_logs)
CREATE OR REPLACE VIEW public.audit_trail_entries AS
SELECT
  id,
  company_id AS tenant_id,
  actor_user_id AS user_id,
  event_type AS action,
  COALESCE(NULLIF(related_entity, ''), 'activity_log')::text AS resource,
  metadata,
  ai_triggered,
  created_at
FROM public.activity_logs;

COMMENT ON VIEW public.audit_trail_entries IS
  'Projection of activity_logs for admin audit / compliance UIs; no duplicate storage.';
