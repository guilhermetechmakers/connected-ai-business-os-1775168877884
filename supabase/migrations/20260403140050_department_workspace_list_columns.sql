-- Department workspace list: typed templates, lifecycle status, headcount (idempotent)

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS department_type text;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS workspace_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS headcount integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'departments_workspace_status_check'
  ) THEN
    ALTER TABLE public.departments
      ADD CONSTRAINT departments_workspace_status_check
      CHECK (workspace_status IN ('active', 'paused', 'inactive'));
  END IF;
END $$;

COMMENT ON COLUMN public.departments.department_type IS 'Template / function label (Sales, Ops, HR, Finance, etc.)';
COMMENT ON COLUMN public.departments.workspace_status IS 'Workspace lifecycle: active, paused, inactive';
COMMENT ON COLUMN public.departments.headcount IS 'Optional roster size for directory KPIs';
