import { normalizeDepartmentDirectory } from "@/components/department-workspace";
import { edgeFunctionAuthHeaders } from "@/lib/edge-gateway-headers";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DepartmentDirectoryRow } from "@/types/department-workspace";

function readSettingsNumber(settings: unknown, key: string): number {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return 0;
  }
  const v = (settings as Record<string, unknown>)[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

function readAiAvailable(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return true;
  }
  const v = (settings as Record<string, unknown>).ai_available;
  return v !== false;
}

function taskPayloadIsOpen(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return true;
  }
  const st = (payload as Record<string, unknown>).status;
  const s = typeof st === "string" ? st.toLowerCase() : "";
  if (!s || s === "open" || s === "in progress" || s === "blocked") {
    return true;
  }
  return false;
}

function resolveDepartmentUserRoleClient(
  leadUserId: string | null,
  userId: string,
  globalRoles: string[],
  memberRole: string | null | undefined,
): "Manager" | "Member" | "Guest" {
  if (
    memberRole === "Manager" ||
    memberRole === "Member" ||
    memberRole === "Guest"
  ) {
    return memberRole;
  }
  if (leadUserId && leadUserId === userId) return "Manager";
  const r = new Set((globalRoles ?? []).map((x) => String(x).toLowerCase()));
  if (r.has("guest")) return "Guest";
  return "Member";
}

function readAiWorkspaceEnabledColumn(
  aiWorkspaceEnabled: unknown,
  settings: unknown,
): boolean {
  if (aiWorkspaceEnabled === false) return false;
  return readAiAvailable(settings);
}

export async function invokeDepartmentWorkspaceApi<T>(
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
      headers: edgeFunctionAuthHeaders(token),
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
  const { data, error } = await invokeDepartmentWorkspaceApi<unknown>({
    op: "tenants.departments.list",
  });

  if (!error && Array.isArray(data)) {
    return normalizeDepartmentDirectory(data);
  }

  if (!isSupabaseConfigured) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data: profileRaw, error: pErr } = await supabase
    .from("profiles")
    .select("company_id,roles")
    .eq("id", uid)
    .maybeSingle();

  const profile = profileRaw as {
    company_id: string | null;
    roles?: string[];
  } | null;
  const companyId = profile?.company_id ?? null;
  const profileRoles = Array.isArray(profile?.roles) ? profile!.roles! : [];
  if (pErr || typeof companyId !== "string" || !companyId) {
    return [];
  }

  const { data: deptRows, error: dErr } = await supabase
    .from("departments")
    .select(
      "id,name,lead_user_id,created_at,updated_at,department_type,workspace_status,headcount,settings,ai_workspace_enabled",
    )
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (dErr) return [];

  const deptList = Array.isArray(deptRows) ? deptRows : [];
  if (deptList.length === 0) return [];

  const { data: dmRows, error: dmErr } = await supabase
    .from("department_members")
    .select("department_id,profile_id,role")
    .eq("company_id", companyId);
  const dmList = !dmErr && Array.isArray(dmRows) ? dmRows : [];
  const memberCountByDept = new Map<string, number>();
  const roleByDeptForUser = new Map<string, string>();
  for (const row of dmList) {
    const r = row as Record<string, unknown>;
    const did = typeof r.department_id === "string" ? r.department_id : "";
    if (!did) continue;
    memberCountByDept.set(did, (memberCountByDept.get(did) ?? 0) + 1);
    if (typeof r.profile_id === "string" && r.profile_id === uid) {
      const rr = typeof r.role === "string" ? r.role : "";
      if (rr) roleByDeptForUser.set(did, rr);
    }
  }

  const leadIds = [
    ...new Set(
      deptList
        .map((row) => {
          const r = row as Record<string, unknown>;
          return typeof r.lead_user_id === "string" ? r.lead_user_id : null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const leadNameById = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,email")
      .in("id", leadIds);
    const plist = Array.isArray(profs) ? profs : [];
    for (const p of plist) {
      const pr = p as Record<string, unknown>;
      const pid = typeof pr.id === "string" ? pr.id : "";
      if (!pid) continue;
      const dn =
        typeof pr.display_name === "string" ? pr.display_name.trim() : "";
      const em = typeof pr.email === "string" ? pr.email.trim() : "";
      leadNameById.set(pid, dn || em || "Lead");
    }
  }

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
        if (taskPayloadIsOpen(row.payload)) m.openTasks += 1;
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
    const leadUserId =
      typeof row.lead_user_id === "string" ? row.lead_user_id : null;
    const leadName = leadUserId ? leadNameById.get(leadUserId) ?? null : null;
    const settings = row.settings;
    const newMessages = readSettingsNumber(settings, "new_messages");
    const headcount =
      typeof row.headcount === "number" && Number.isFinite(row.headcount)
        ? Math.max(0, Math.floor(row.headcount))
        : 0;
    const roster = memberCountByDept.get(id) ?? 0;
    const activeMembers =
      headcount > 0
        ? headcount
        : roster > 0
          ? roster
          : readSettingsNumber(settings, "active_members");
    const updatedAt =
      typeof row.updated_at === "string"
        ? row.updated_at
        : new Date().toISOString();
    const createdAt =
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString();
    const wsRaw =
      typeof row.workspace_status === "string"
        ? row.workspace_status
        : "active";
    const ws = wsRaw.toLowerCase();
    const status: DepartmentDirectoryRow["status"] =
      ws === "paused" ? "paused" : ws === "inactive" ? "inactive" : "active";
    const dt =
      typeof row.department_type === "string" && row.department_type.trim()
        ? row.department_type.trim()
        : null;

    out.push({
      id,
      name,
      leadUserId,
      leadName,
      createdAt,
      updatedAt,
      lastUpdated: updatedAt,
      type: dt,
      headcount,
      userRole: resolveDepartmentUserRoleClient(
        leadUserId,
        uid,
        profileRoles,
        roleByDeptForUser.get(id),
      ),
      aiAvailable: readAiWorkspaceEnabledColumn(
        row.ai_workspace_enabled,
        settings,
      ),
      metrics: {
        ...m,
        newMessages,
        activeMembers,
        lastActivity: updatedAt,
      },
      status,
    });
  }

  return out;
}
