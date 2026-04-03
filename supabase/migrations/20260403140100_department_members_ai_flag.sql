-- Per-user department roles + AI workspace toggle (idempotent)

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS ai_workspace_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.departments.ai_workspace_enabled IS 'When false, hide department-scoped AI assistant entry points';

CREATE TABLE IF NOT EXISTS public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Member',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_members_role_check CHECK (
    role IN ('Manager', 'Member', 'Guest')
  ),
  UNIQUE (department_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_department_members_company ON public.department_members (company_id);
CREATE INDEX IF NOT EXISTS idx_department_members_dept ON public.department_members (department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_profile ON public.department_members (profile_id);

ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS department_members_all ON public.department_members;
CREATE POLICY department_members_all ON public.department_members
  FOR ALL USING (company_id = public.current_company_id());
