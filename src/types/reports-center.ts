import type { Json } from "@/types/database";

export type KpiMetricRow = {
  id: string;
  company_id: string;
  name: string;
  definition: Json;
  cached_value: Json | null;
  schedule: Json | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportCenterReportRow = {
  id: string;
  company_id: string;
  department_id: string | null;
  owner_user_id: string | null;
  name: string;
  description: string;
  status: string;
  tags: string[];
  data_source_refs: string[];
  kpi_refs: string[];
  visuals: Json;
  schedule_ids: string[];
  export_targets: Json;
  created_at: string;
  updated_at: string;
};

export type ReportCenterScheduleRow = {
  id: string;
  company_id: string;
  report_id: string;
  cadence: string;
  cron_expression: string | null;
  recipients: Json;
  delivery_modes: Json;
  export_formats: string[];
  active: boolean;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportExportJobRow = {
  id: string;
  company_id: string;
  report_id: string;
  format: string;
  destination: Json;
  status: string;
  error_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type DepartmentOptionRow = {
  id: string;
  name: string;
  company_id: string;
};

export type DataSourceEntityRow = {
  id: string;
  entity_type: string;
  payload: Json;
  department_id: string | null;
  updated_at: string;
};

export type ReportAiSummaryResult = {
  summary: string;
  citations: Array<{ type: string; id: string }>;
};

export type ReportsCenterFilters = {
  departmentId: string | null;
  status: string | null;
  tag: string | null;
  search: string;
  ownerOnly: boolean;
};
