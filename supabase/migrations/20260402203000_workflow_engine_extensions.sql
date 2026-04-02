-- Workflow & Automation Engine — schema extensions (idempotent)

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Untitled workflow';

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS related_entity text;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS related_id uuid;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_event_company_created
  ON public.activity_logs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type
  ON public.activity_logs (company_id, event_type);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_status
  ON public.workflow_runs (workflow_id, status);

CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.workflow_runs (id) ON DELETE CASCADE,
  step_id text,
  approver_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decision text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_run_id ON public.workflow_approvals (run_id);

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_approvals_all ON public.workflow_approvals;
CREATE POLICY workflow_approvals_all ON public.workflow_approvals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflow_runs wr
      JOIN public.workflows w ON w.id = wr.workflow_id
      WHERE wr.id = run_id AND w.company_id = public.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workflow_runs wr
      JOIN public.workflows w ON w.id = wr.workflow_id
      WHERE wr.id = run_id AND w.company_id = public.current_company_id()
    )
  );
