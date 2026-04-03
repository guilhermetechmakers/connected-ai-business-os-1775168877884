/**
 * Admin Console REST-style facade — super_admin + service role only.
 * Maps documented paths to cross-tenant reads for platform operators.
 * Prefer domain Edge Functions (`tenants-api`, `activity-logs-api`) for mutations; this
 * endpoint supports GET-style discovery and lightweight aggregations.
 *
 * Usage: POST body `{ path: string, method?: string, query?: Record<string,string>, body?: unknown }`
 *   or GET `?path=/admin/tenants&limit=25` with Authorization: Bearer <user JWT>.
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const requestSchema = z.object({
  path: z.string().min(1).max(200),
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).optional(),
  query: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function canAccessAdminConsoleApi(roles: string[]): boolean {
  const r = (Array.isArray(roles) ? roles : []).map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["super_admin", "compliance_auditor", "auditor"].includes(x)
  );
}

async function requireSuperAndAdminClient(
  req: Request,
): Promise<{ userId: string; admin: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Response(JSON.stringify({ error: "Server missing service role" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: prof, error: pErr } = await userClient
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr) {
    throw new Response(JSON.stringify({ error: pErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const roles = Array.isArray(prof?.roles) ? (prof!.roles as string[]) : [];
  if (!canAccessAdminConsoleApi(roles)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(url, serviceKey);
  return { userId: user.id, admin };
}

function normalizePath(p: string): string {
  const t = p.trim();
  if (!t.startsWith("/")) return `/${t}`;
  return t.replace(/\/+$/, "") || "/";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, admin } = await requireSuperAndAdminClient(req);

    let path = "";
    let query: Record<string, string> = {};

    if (req.method === "GET") {
      const u = new URL(req.url);
      path = normalizePath(u.searchParams.get("path") ?? "/admin/health");
      u.searchParams.forEach((v, k) => {
        if (k !== "path") query[k] = v;
      });
    } else if (req.method === "POST") {
      const raw = await req.json().catch(() => ({}));
      const parsed = requestSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
      }
      path = normalizePath(parsed.data.path);
      query = parsed.data.query ?? {};
    } else {
      return json({ error: "Method not allowed" }, 405);
    }

    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? "25", 10) || 25),
    );
    const offset = Math.max(0, parseInt(query.offset ?? "0", 10) || 0);

    switch (path) {
      case "/admin/health":
        return json({ ok: true, service: "admin-console-api", userId });

      case "/admin/tenants": {
        let q = admin.from("companies").select("*", { count: "exact" });
        const search = query.search?.trim();
        if (search) {
          const safe = search.replace(/[%*,()]/g, "");
          const s = `%${safe}%`;
          q = q.or(`name.ilike.${s},legal_name.ilike.${s},display_name.ilike.${s}`);
        }
        if (query.tenantStatus) q = q.eq("tenant_status", query.tenantStatus);
        q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        const { data, error, count } = await q;
        if (error) return json({ error: error.message }, 500);
        const rows = Array.isArray(data) ? data : [];
        return json({
          data: rows,
          count: typeof count === "number" ? count : rows.length,
        });
      }

      case "/admin/templates": {
        const { data, error } = await admin
          .from("system_templates")
          .select("*")
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return json({ error: error.message }, 500);
        return json({ data: Array.isArray(data) ? data : [] });
      }

      case "/admin/feature-flags": {
        const { data, error } = await admin
          .from("feature_flags")
          .select("*")
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return json({ error: error.message }, 500);
        return json({ data: Array.isArray(data) ? data : [] });
      }

      case "/admin/logs/activity": {
        const tenantId = query.tenantId?.trim();
        let q = admin
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (tenantId) q = q.eq("company_id", tenantId);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ data: Array.isArray(data) ? data : [] });
      }

      case "/admin/logs/audit": {
        const tenantId = query.tenantId?.trim();
        const aiOnly = query.aiOnly === "true" || query.aiOnly === "1";
        let q = admin
          .from("activity_logs")
          .select("*")
          .eq("event_type", "admin_action");
        if (tenantId) q = q.eq("company_id", tenantId);
        if (aiOnly) q = q.eq("ai_triggered", true);
        q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ data: Array.isArray(data) ? data : [] });
      }

      case "/admin/integrations": {
        const tenantId = query.tenantId?.trim();
        let q = admin.from("integrations").select("*").order("updated_at", {
          ascending: false,
        }).range(offset, offset + limit - 1);
        if (tenantId) q = q.eq("company_id", tenantId);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ data: Array.isArray(data) ? data : [] });
      }

      default:
        return json(
          {
            error: "Unknown path",
            hint: "Try /admin/health, /admin/tenants, /admin/templates, /admin/feature-flags, /admin/logs/activity, /admin/logs/audit, /admin/integrations",
          },
          404,
        );
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
