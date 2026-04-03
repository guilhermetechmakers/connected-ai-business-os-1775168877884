/**
 * Department Workspace API — tenant departments directory, task entity creation, department-scoped AI generation.
 * Mirrors REST-style resources: tenants/departments, departments/:id/tasks, departments/:id/ai/generate.
 * Client: supabase.functions.invoke('department-workspace-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY; OPENAI_API_KEY optional for ai.generate.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("tenants.departments.list") }),
  z.object({
    op: z.literal("department.tasks.create"),
    departmentId: z.string().uuid(),
    title: z.string().min(1).max(500),
    description: z.string().max(8000).optional(),
    status: z.string().max(80).optional(),
    priority: z.string().max(40).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: z.string().optional(),
  }),
  z.object({
    op: z.literal("department.ai.generate"),
    departmentId: z.string().uuid(),
    departmentName: z.string().min(1).max(200),
    prompt: z.string().min(1).max(12000),
    contextSummary: z.string().max(8000).optional(),
  }),
]);

type ParsedOp = z.infer<typeof opSchema>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(
  req: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw json({ error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw json({ error: "Unauthorized" }, 401);
  }
  return { supabase, userId: user.id };
}

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ company_id: string | null; roles: string[] }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id, roles")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const roles = Array.isArray(data?.roles) ? data!.roles as string[] : [];
  return { company_id: data?.company_id ?? null, roles };
}

function normalizeRoles(roles: string[]): Set<string> {
  return new Set((roles ?? []).map((r) => r.toLowerCase()));
}

function canMutateTasks(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("executive") ||
    r.has("manager")
  );
}

async function assertDepartmentInTenant(
  supabase: SupabaseClient,
  companyId: string,
  departmentId: string,
): Promise<{ name: string } | null> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("id", departmentId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.name) return null;
  return { name: data.name as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const profile = await loadProfile(supabase, userId);
    const companyId = profile.company_id;
    if (!companyId) {
      return json({ error: "No tenant context" }, 403);
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    }
    const op = parsed.data;

    switch (op.op) {
      case "tenants.departments.list": {
        const { data: depts, error: dErr } = await supabase
          .from("departments")
          .select("id, name, lead_user_id, created_at, updated_at")
          .eq("company_id", companyId)
          .order("name", { ascending: true });
        if (dErr) throw dErr;
        const deptList = Array.isArray(depts) ? depts : [];

        const { data: entities, error: eErr } = await supabase
          .from("unified_entities")
          .select("department_id, entity_type")
          .eq("company_id", companyId)
          .eq("is_deleted", false);
        if (eErr) throw eErr;
        const entRows = Array.isArray(entities) ? entities : [];

        const metrics = new Map<
          string,
          { openTasks: number; kpis: number; documents: number }
        >();
        for (const row of deptList) {
          const id = row.id as string;
          metrics.set(id, { openTasks: 0, kpis: 0, documents: 0 });
        }
        for (const e of entRows) {
          const did = e.department_id as string | null;
          if (!did || !metrics.has(did)) continue;
          const m = metrics.get(did)!;
          const t = e.entity_type as string;
          if (t === "Task") m.openTasks += 1;
          else if (t === "KPI") m.kpis += 1;
          else if (t === "Document") m.documents += 1;
        }

        const enriched = deptList.map((d) => {
          const id = d.id as string;
          const m = metrics.get(id) ?? { openTasks: 0, kpis: 0, documents: 0 };
          return {
            id,
            name: d.name as string,
            leadUserId: (d.lead_user_id as string | null) ?? null,
            createdAt: d.created_at as string,
            updatedAt: d.updated_at as string,
            metrics: m,
            status: "active" as const,
          };
        });

        return json({ data: enriched });
      }

      case "department.tasks.create": {
        if (!canMutateTasks(profile.roles)) {
          return json({ error: "Forbidden" }, 403);
        }
        const dept = await assertDepartmentInTenant(supabase, companyId, op.departmentId);
        if (!dept) return json({ error: "Department not found" }, 404);

        const due = op.dueDate?.trim();
        const payload: Record<string, unknown> = {
          title: op.title,
          description: op.description ?? "",
          status: op.status ?? "open",
          priority: op.priority ?? "medium",
          assigneeId: op.assigneeId ?? null,
        };
        if (due) {
          const t = Date.parse(due);
          if (Number.isNaN(t)) {
            return json({ error: "Invalid dueDate" }, 400);
          }
          payload.dueDate = new Date(t).toISOString();
        }

        const { data: row, error: insErr } = await supabase
          .from("unified_entities")
          .insert({
            company_id: companyId,
            entity_type: "Task",
            payload,
            source_references: [],
            department_id: op.departmentId,
          })
          .select("*")
          .single();
        if (insErr) throw insErr;

        await supabase.from("activity_logs").insert({
          company_id: companyId,
          event_type: "department.task.create",
          actor_user_id: userId,
          payload: { departmentId: op.departmentId, taskId: row?.id },
          department_id: op.departmentId,
        });

        return json({ data: row });
      }

      case "department.ai.generate": {
        const dept = await assertDepartmentInTenant(supabase, companyId, op.departmentId);
        if (!dept) return json({ error: "Department not found" }, 404);

        const system = [
          "You are the department AI assistant for Connected AI Business OS.",
          `Tenant-scoped. Department: ${op.departmentName} (${op.departmentId}).`,
          "Use only the provided context; cite uncertainty when context is insufficient.",
          op.contextSummary
            ? `Context (truncated):\n${op.contextSummary.slice(0, 6000)}`
            : "No structured context payload was supplied.",
        ].join("\n");

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        let reply: string;
        if (!apiKey) {
          reply =
            `[Offline mode] Received: ${op.prompt.slice(0, 280)}${op.prompt.length > 280 ? "…" : ""}\n\nConfigure OPENAI_API_KEY on the project for live completions.`;
        } else {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: system },
                { role: "user", content: op.prompt },
              ],
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            const errMsg =
              typeof body?.error?.message === "string"
                ? body.error.message
                : "AI provider error";
            return json({ error: errMsg }, 502);
          }
          const choice = body?.choices?.[0]?.message?.content;
          reply = typeof choice === "string" ? choice : "No content returned.";
        }

        await supabase.from("ai_action_logs").insert({
          company_id: companyId,
          user_id: userId,
          action_name: "department.ai.generate",
          status: "completed",
          details: {
            departmentId: op.departmentId,
            promptPreview: op.prompt.slice(0, 200),
          },
        });

        return json({
          data: {
            reply,
            sources: [{ type: "department_context", id: op.departmentId }],
          },
        });
      }

      default:
        return json({ error: "Unsupported" }, 400);
    }
  } catch (e) {
    if (e instanceof Response) {
      return e;
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
