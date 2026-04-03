import { fetchTenantDepartmentsDirectory } from "@/lib/department-workspace-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  DepartmentWorkspaceListItem,
  DepartmentWorkspaceListMetrics,
  DepartmentWorkspaceStatus,
  DepartmentWorkspaceUserRole,
} from "@/types/department-workspace-list";

const DEMO_DEPARTMENTS: DepartmentWorkspaceListItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Revenue",
    leadName: "Alex Chen",
    headcount: 18,
    status: "active",
    type: "Sales",
    metrics: {
      openTasks: 24,
      newMessages: 6,
      activeMembers: 18,
      lastActivity: new Date().toISOString(),
      kpis: 5,
      documents: 12,
    },
    userRole: "Manager",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Product",
    leadName: "Jordan Lee",
    headcount: 22,
    status: "active",
    type: "Ops",
    metrics: {
      openTasks: 31,
      newMessages: 3,
      activeMembers: 22,
      lastActivity: new Date().toISOString(),
      kpis: 8,
      documents: 20,
    },
    userRole: "Member",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Operations",
    leadName: "Sam Rivera",
    headcount: 14,
    status: "paused",
    type: "Ops",
    metrics: {
      openTasks: 9,
      newMessages: 0,
      activeMembers: 14,
      lastActivity: new Date().toISOString(),
      kpis: 4,
      documents: 7,
    },
    userRole: "Guest",
    aiAvailable: false,
    lastUpdated: new Date().toISOString(),
  },
];

function parseWorkspaceStatus(raw: unknown): DepartmentWorkspaceStatus {
  const s = typeof raw === "string" ? raw.toLowerCase() : "active";
  if (s === "paused" || s === "inactive") return s;
  return "active";
}

function parseUserRole(raw: unknown): DepartmentWorkspaceUserRole {
  if (raw === "Manager" || raw === "Member" || raw === "Guest") return raw;
  return "Member";
}

function parseMetrics(raw: unknown): DepartmentWorkspaceListMetrics {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      openTasks: 0,
      newMessages: 0,
      activeMembers: 0,
      lastActivity: new Date().toISOString(),
      kpis: 0,
      documents: 0,
    };
  }
  const m = raw as Record<string, unknown>;
  return {
    openTasks: typeof m.openTasks === "number" ? m.openTasks : 0,
    newMessages: typeof m.newMessages === "number" ? m.newMessages : 0,
    activeMembers: typeof m.activeMembers === "number" ? m.activeMembers : 0,
    lastActivity:
      typeof m.lastActivity === "string"
        ? m.lastActivity
        : new Date().toISOString(),
    kpis: typeof m.kpis === "number" ? m.kpis : 0,
    documents: typeof m.documents === "number" ? m.documents : 0,
  };
}

/** Runtime guard for API / edge list payloads. */
export function validateDepartmentShape(
  raw: unknown,
): DepartmentWorkspaceListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  if (!id || !name) return null;
  const leadName =
    o.leadName === null
      ? null
      : typeof o.leadName === "string"
        ? o.leadName
        : null;
  const headcount =
    typeof o.headcount === "number" && Number.isFinite(o.headcount)
      ? Math.max(0, Math.floor(o.headcount))
      : 0;
  const type =
    o.type === null
      ? null
      : typeof o.type === "string" && o.type.trim()
        ? o.type.trim()
        : null;
  const lastUpdated =
    typeof o.lastUpdated === "string"
      ? o.lastUpdated
      : typeof o.updatedAt === "string"
        ? o.updatedAt
        : new Date().toISOString();
  return {
    id,
    name,
    leadName,
    headcount,
    status: parseWorkspaceStatus(o.status),
    type,
    metrics: parseMetrics(o.metrics),
    userRole: parseUserRole(o.userRole),
    aiAvailable: o.aiAvailable !== false,
    lastUpdated,
  };
}

export function parseWorkspaceDepartmentList(raw: unknown): DepartmentWorkspaceListItem[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: DepartmentWorkspaceListItem[] = [];
  for (const row of list) {
    const v = validateDepartmentShape(row);
    if (v) out.push(v);
  }
  return out;
}

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

async function mapDirectoryFallbackToCatalog(
  userId: string | null,
): Promise<DepartmentWorkspaceListItem[]> {
  const rows = await fetchTenantDepartmentsDirectory();
  const safeRows = Array.isArray(rows) ? rows : [];
  const out: DepartmentWorkspaceListItem[] = [];
  for (const d of safeRows) {
    if (!d?.id || !d.name) continue;
    const leadName = d.leadUserId
      ? `User ${d.leadUserId.slice(0, 8)}…`
      : null;
    const m = d.metrics ?? { openTasks: 0, kpis: 0, documents: 0 };
    const userRole: DepartmentWorkspaceUserRole =
      userId && d.leadUserId === userId ? "Manager" : "Member";
    out.push({
      id: d.id,
      name: d.name,
      leadName,
      headcount: 0,
      status: d.status === "archived" ? "inactive" : "active",
      type: null,
      metrics: {
        openTasks: m.openTasks ?? 0,
        newMessages: 0,
        activeMembers: 0,
        lastActivity: d.updatedAt ?? new Date().toISOString(),
        kpis: m.kpis ?? 0,
        documents: m.documents ?? 0,
      },
      userRole,
      aiAvailable: true,
      lastUpdated: d.updatedAt ?? new Date().toISOString(),
    });
  }
  return out;
}

/**
 * Workspace directory: Edge Function `tenants.departments.list` with guarded parsing;
 * falls back to `fetchTenantDepartmentsDirectory` or demo rows when unauthenticated / offline.
 */
export async function fetchDepartmentWorkspaceListCatalog(): Promise<
  DepartmentWorkspaceListItem[]
> {
  if (!isSupabaseConfigured) {
    return [...DEMO_DEPARTMENTS];
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;

  const { data, error } = await invokeDepartmentWorkspaceApi<unknown[]>({
    op: "tenants.departments.list",
  });

  if (!error && Array.isArray(data)) {
    const parsed = parseWorkspaceDepartmentList(data);
    if (parsed.length > 0) return parsed;
  }

  const fallback = await mapDirectoryFallbackToCatalog(userId);
  if (fallback.length > 0) return fallback;

  return [...DEMO_DEPARTMENTS];
}

export type CreateDepartmentWorkspaceInput = {
  name: string;
  departmentType?: string;
  leadUserId?: string | null;
  workspaceStatus?: DepartmentWorkspaceStatus;
  headcount?: number | null;
};

export async function createTenantDepartmentWorkspace(
  input: CreateDepartmentWorkspaceInput,
): Promise<{ data: DepartmentWorkspaceListItem | null; error: string | null }> {
  const body: Record<string, unknown> = {
    op: "tenants.departments.create",
    name: input.name.trim(),
  };
  if (input.departmentType?.trim()) {
    body.departmentType = input.departmentType.trim();
  }
  if (input.leadUserId !== undefined) {
    body.leadUserId = input.leadUserId;
  }
  if (input.workspaceStatus) {
    body.workspaceStatus = input.workspaceStatus;
  }
  if (input.headcount != null) {
    body.headcount = input.headcount;
  }

  const { data, error } = await invokeDepartmentWorkspaceApi<unknown>(body);
  if (error) {
    return { data: null, error };
  }
  const item = validateDepartmentShape(data);
  return { data: item, error: item ? null : "Invalid department response" };
}
