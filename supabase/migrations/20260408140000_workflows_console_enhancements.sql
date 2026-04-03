-- Workflows console: retries, run inputs, schedule preview column, approval SLA metadata (idempotent)

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz;

ALTER TABLE public.workflow_approvals
  ADD COLUMN IF NOT EXISTS due_by timestamptz,
  ADD COLUMN IF NOT EXISTS approvers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workflows_company_next_run
  ON public.workflows (company_id, next_run_at)
  WHERE next_run_at IS NOT NULL;
