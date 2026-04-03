export type ExecutiveKpiTile = {
  id: string;
  name: string;
  valueText: string;
  delta: string | null;
  unit: string | null;
  trend: "up" | "down" | "neutral";
};

export type ExecutiveRiskIssue = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  ownerDepartmentId: string | null;
  dueDate: string | null;
};

export type ExecutiveDepartmentHeatCell = {
  departmentId: string;
  name: string;
  intensity: number;
  trend: "up" | "down" | "neutral";
};

export type ExecutiveDashboardSnapshot = {
  kpis: ExecutiveKpiTile[];
  risks: ExecutiveRiskIssue[];
  departments: ExecutiveDepartmentHeatCell[];
  generatedAt: string;
};

export function normalizeExecutiveSnapshot(raw: unknown): ExecutiveDashboardSnapshot {
  if (!raw || typeof raw !== "object") {
    return { kpis: [], risks: [], departments: [], generatedAt: new Date().toISOString() };
  }
  const o = raw as Record<string, unknown>;
  const kpisRaw = o.kpis;
  const risksRaw = o.risks;
  const deptsRaw = o.departments;
  const kpis = Array.isArray(kpisRaw)
    ? kpisRaw
        .map((item): ExecutiveKpiTile | null => {
          if (!item || typeof item !== "object") return null;
          const r = item as Record<string, unknown>;
          const trend = r.trend === "up" || r.trend === "down" || r.trend === "neutral" ? r.trend : "neutral";
          return {
            id: String(r.id ?? ""),
            name: String(r.name ?? ""),
            valueText: String(r.valueText ?? r.value_text ?? ""),
            delta: r.delta != null ? String(r.delta) : null,
            unit: r.unit != null ? String(r.unit) : null,
            trend,
          };
        })
        .filter((x): x is ExecutiveKpiTile => Boolean(x?.id))
    : [];
  const risks = Array.isArray(risksRaw)
    ? risksRaw
        .map((item): ExecutiveRiskIssue | null => {
          if (!item || typeof item !== "object") return null;
          const r = item as Record<string, unknown>;
          const sev = String(r.severity ?? "medium");
          const severity =
            sev === "low" || sev === "medium" || sev === "high" || sev === "critical" ? sev : "medium";
          return {
            id: String(r.id ?? ""),
            title: String(r.title ?? ""),
            severity,
            status: String(r.status ?? ""),
            ownerDepartmentId:
              r.ownerDepartmentId != null
                ? String(r.ownerDepartmentId)
                : r.owner_department_id != null
                  ? String(r.owner_department_id)
                  : null,
            dueDate:
              r.dueDate != null
                ? String(r.dueDate)
                : r.due_date != null
                  ? String(r.due_date)
                  : null,
          };
        })
        .filter((x): x is ExecutiveRiskIssue => Boolean(x?.id))
    : [];
  const departments = Array.isArray(deptsRaw)
    ? deptsRaw
        .map((item): ExecutiveDepartmentHeatCell | null => {
          if (!item || typeof item !== "object") return null;
          const r = item as Record<string, unknown>;
          const trend = r.trend === "up" || r.trend === "down" || r.trend === "neutral" ? r.trend : "neutral";
          const intensity =
            typeof r.intensity === "number" && !Number.isNaN(r.intensity)
              ? Math.min(100, Math.max(0, r.intensity))
              : 0;
          const departmentId =
            r.departmentId != null
              ? String(r.departmentId)
              : r.department_id != null
                ? String(r.department_id)
                : "";
          return {
            departmentId,
            name: String(r.name ?? ""),
            intensity,
            trend,
          };
        })
        .filter((x): x is ExecutiveDepartmentHeatCell => Boolean(x?.departmentId))
    : [];
  return {
    kpis,
    risks,
    departments,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : new Date().toISOString(),
  };
}
