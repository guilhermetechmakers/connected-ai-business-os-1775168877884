-- Reports Center tables for `reports-center-api` Edge Function (idempotent)

CREATE TABLE IF NOT EXISTS public.kpi_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled KPI',
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  cached_value jsonb,
  schedule jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_metrics_company
  ON public.kpi_metrics (company_id);

CREATE TABLE IF NOT EXISTS public.report_center_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  tags text[] NOT NULL DEFAULT '{}',
  data_source_refs text[] NOT NULL DEFAULT '{}',
  kpi_refs uuid[] NOT NULL DEFAULT '{}',
  visuals jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_ids uuid[] NOT NULL DEFAULT '{}',
  export_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_center_reports_company
  ON public.report_center_reports (company_id);
CREATE INDEX IF NOT EXISTS idx_report_center_reports_dept
  ON public.report_center_reports (company_id, department_id);

CREATE TABLE IF NOT EXISTS public.report_center_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.report_center_reports (id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'daily',
  cron_expression text,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  export_formats text[] NOT NULL DEFAULT ARRAY['csv']::text[],
  active boolean NOT NULL DEFAULT false,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_center_schedules_company
  ON public.report_center_schedules (company_id);
CREATE INDEX IF NOT EXISTS idx_report_center_schedules_report
  ON public.report_center_schedules (report_id);

CREATE TABLE IF NOT EXISTS public.report_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.report_center_reports (id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'csv',
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_export_jobs_company
  ON public.report_export_jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_report_export_jobs_report
  ON public.report_export_jobs (report_id);

ALTER TABLE public.kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_center_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_center_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_metrics_all ON public.kpi_metrics;
CREATE POLICY kpi_metrics_all ON public.kpi_metrics
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS report_center_reports_all ON public.report_center_reports;
CREATE POLICY report_center_reports_all ON public.report_center_reports
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS report_center_schedules_all ON public.report_center_schedules;
CREATE POLICY report_center_schedules_all ON public.report_center_schedules
  FOR ALL USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS report_export_jobs_all ON public.report_export_jobs;
CREATE POLICY report_export_jobs_all ON public.report_export_jobs
  FOR ALL USING (company_id = public.current_company_id());
