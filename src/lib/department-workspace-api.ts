import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DepartmentDirectoryRow } from "@/types/department-workspace";

async function invokeDepartmentWorkspaceApi<T>(
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error:
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { data: null, error: "Not signed in" };
  }

  const { data, error } = await supabase.functions.invoke<unknown>(
    "department-workspace-api",
    {
      body,
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (error) {
    return { data: null, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (err !== undefined && err !== null) {
      return { data: null, error: String(err) };
    }
  }

  if (data && typeof data === "object" && "data" in data) {
    return { data: (data as { data: T }).data ?? null, error: null };
  }

  return { data: data as T, error: null };
}

/**
 * Tenant department directory with unified-entity metrics (Edge Function + RLS).
 * Falls back to direct Supabase reads when the function is not deployed.
 */
export async function fetchTenantDepartmentsDirectory(): Promise<
  DepartmentDirectoryRow[]
> {
  const { data, error } = await invokeDepartmentWorkspaceApi<DepartmentDirectoryRow[]>({
    op: "tenants.departments.list",
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return data;
  }

  if (!isSupabaseConfigured) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data: profileRaw, error: pErr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", uid)
    .maybeSingle();

  const profile = profileRaw as { company_id: string | null } | null;
  const companyId = profile?.company_id ?? null;
  if (pErr || typeof companyId !== "string" || !companyId) {
    return [];
  }

  const { data: deptRows, error: dErr } = await supabase
    .from("departments")
    .select("id,name,lead_user_id,created_at,updated_at")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (dErr) return [];

  const deptList = Array.isArray(deptRows) ? deptRows : [];
  if (deptList.length === 0) return [];

  const { data: entityRows, error: eErr } = await supabase
    .from("unified_entities")
    .select("department_id,entity_type,payload")
    .eq("company_id", companyId)
    .eq("is_deleted", false)
    .limit(2000);

  const metricsMap = new Map<
    string,
    { openTasks: number; kpis: number; documents: number }
  >();

  if (!eErr && Array.isArray(entityRows)) {
    for (const e of entityRows) {
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;
      const deptId =
        typeof row.department_id === "string" ? row.department_id : null;
      if (!deptId) continue;
      const et = typeof row.entity_type === "string" ? row.entity_type : "";
      const m = metricsMap.get(deptId) ?? {
        openTasks: 0,
        kpis: 0,
        documents: 0,
      };
      if (et === "KPI") m.kpis += 1;
      else if (et === "Document") m.documents += 1;
      else if (et === "Task") {
        const payload = row.payload;
        let st = "";
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const s = (payload as Record<string, unknown>).status;
          st = typeof s === "string" ? s.toLowerCase() : "";
        }
        if (!st || st === "open" || st === "in progress" || st === "blocked") {
          m.openTasks += 1;
        }
      }
      metricsMap.set(deptId, m);
    }
  }

  const out: DepartmentDirectoryRow[] = [];
  for (const r of deptList) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    const name = typeof row.name === "string" ? row.name : "Department";
    const m = metricsMap.get(id) ?? { openTasks: 0, kpis: 0, documents: 0 };
    out.push({
      id,
      name,
      leadUserId: typeof row.lead_user_id === "string" ? row.lead_user_id : null,
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
      updatedAt:
        typeof row.updated_at === "string"
          ? row.updated_at
          : new Date().toISOString(),
      metrics: m,
      status: "active",
    });
  }

  return out;
}
