-- Executive dashboard metrics: tenant-scoped KPIs, risks, department heat intensities, export audit (idempotent)

-- ---------------------------------------------------------------------------
-- Executive KPI tiles (optional curated metrics; UI falls back to rollups when empty)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.executive_kpi_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  value_text text NOT NULL,
  delta text,
  unit text,
  trend text NOT NULL DEFAULT 'neutral' CHECK (trend IN ('up', 'down', 'neutral')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_kpi_metrics_company_sort
  ON public.executive_kpi_metrics (company_id, sort_order);

-- ---------------------------------------------------------------------------
-- Executive risk register
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.executive_risk_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open',
  owner_department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_risk_issues_company_severity
  ON public.executive_risk_issues (company_id, severity);

-- ---------------------------------------------------------------------------
-- Department heatmap intensities (0–100); optional curated layer over directory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_exec_intensity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  intensity integer NOT NULL CHECK (intensity >= 0 AND intensity <= 100),
  trend text NOT NULL DEFAULT 'neutral' CHECK (trend IN ('up', 'down', 'neutral')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_department_exec_intensity_company
  ON public.department_exec_intensity (company_id);

-- ---------------------------------------------------------------------------
-- Export job audit (client-triggered executive exports; artifact_url optional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.executive_report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  export_type text NOT NULL CHECK (export_type IN ('csv', 'pdf', 'json')),
  status text NOT NULL DEFAULT 'completed',
  artifact_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_report_exports_company_created
  ON public.executive_report_exports (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.executive_kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_risk_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_exec_intensity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS executive_kpi_metrics_select ON public.executive_kpi_metrics;
CREATE POLICY executive_kpi_metrics_select ON public.executive_kpi_metrics
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS executive_risk_issues_select ON public.executive_risk_issues;
CREATE POLICY executive_risk_issues_select ON public.executive_risk_issues
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS department_exec_intensity_select ON public.department_exec_intensity;
CREATE POLICY department_exec_intensity_select ON public.department_exec_intensity
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS executive_report_exports_select ON public.executive_report_exports;
CREATE POLICY executive_report_exports_select ON public.executive_report_exports
  FOR SELECT USING (company_id = public.current_company_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS executive_report_exports_insert ON public.executive_report_exports;
CREATE POLICY executive_report_exports_insert ON public.executive_report_exports
  FOR INSERT WITH CHECK (company_id = public.current_company_id() AND user_id = auth.uid());
