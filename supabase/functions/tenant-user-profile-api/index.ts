/**
 * Tenant-scoped user profile REST facade — maps documented REST paths to auth-api / activity-logs-api.
 * Client: POST with JSON { path, body?, query? } using the caller Authorization JWT.
 * Validates tenantId and userId in the path against the authenticated profile before forwarding.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const requestSchema = z.object({
  path: z.string().min(1).max(500),
  body: z.record(z.string(), z.unknown()).optional(),
  query: z
    .object({
      userId: z.string().uuid().optional(),
      range: z.string().max(32).optional(),
      eventType: z.string().max(120).optional(),
    })
    .optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function forwardAuthApi(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/auth-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function forwardActivityLogsApi(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/activity-logs-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function rangeToDateFrom(range: string | undefined): string | null {
  const r = (range ?? "30d").toLowerCase();
  const now = Date.now();
  const day = 86400000;
  if (r === "all") return null;
  if (r === "7d") return new Date(now - 7 * day).toISOString();
  if (r === "30d") return new Date(now - 30 * day).toISOString();
  if (r === "90d") return new Date(now - 90 * day).toISOString();
  return new Date(now - 30 * day).toISOString();
}

type PathCtx = {
  method: string;
  tenantId: string;
  userId: string;
  connectionId?: string;
  keyId?: string;
};

function parsePath(raw: string): PathCtx | null {
  const s = raw.trim();
  const m1 =
    /^(GET|PATCH)\s+\/tenants\/([^/]+)\/users\/([^/]+)\/profile$/i.exec(s);
  if (m1) {
    return { method: m1[1].toUpperCase(), tenantId: m1[2], userId: m1[3] };
  }
  const m2 = /^GET\s+\/tenants\/([^/]+)\/users\/([^/]+)\/auth-methods$/i.exec(s);
  if (m2) {
    return { method: "GET", tenantId: m2[1], userId: m2[2] };
  }
  const m3 =
    /^(GET|PATCH)\s+\/tenants\/([^/]+)\/users\/([^/]+)\/notifications$/i.exec(s);
  if (m3) {
    return { method: m3[1].toUpperCase(), tenantId: m3[2], userId: m3[3] };
  }
  const m4 = /^GET\s+\/tenants\/([^/]+)\/users\/([^/]+)\/connections$/i.exec(s);
  if (m4) {
    return { method: "GET", tenantId: m4[1], userId: m4[2] };
  }
  const m5 =
    /^PATCH\s+\/tenants\/([^/]+)\/users\/([^/]+)\/connections\/([^/]+)$/i.exec(s);
  if (m5) {
    return {
      method: "PATCH",
      tenantId: m5[1],
      userId: m5[2],
      connectionId: m5[3],
    };
  }
  const m6 = /^(GET|POST)\s+\/tenants\/([^/]+)\/users\/([^/]+)\/api-keys$/i.exec(s);
  if (m6) {
    return { method: m6[1].toUpperCase(), tenantId: m6[2], userId: m6[3] };
  }
  const m7 =
    /^(PATCH|DELETE)\s+\/tenants\/([^/]+)\/users\/([^/]+)\/api-keys\/([^/]+)$/i.exec(s);
  if (m7) {
    return {
      method: m7[1].toUpperCase(),
      tenantId: m7[2],
      userId: m7[3],
      keyId: m7[4],
    };
  }
  const m8 = /^GET\s+\/tenants\/([^/]+)\/activities$/i.exec(s);
  if (m8) {
    return { method: "GET", tenantId: m8[1], userId: "" };
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  let parsedBody: z.infer<typeof requestSchema>;
  try {
    const raw = await req.json();
    const p = requestSchema.safeParse(raw);
    if (!p.success) {
      return json({ error: "Invalid body", details: p.error.flatten() }, 400);
    }
    parsedBody = p.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const ctx = parsePath(parsedBody.path);
  if (!ctx) {
    return json({ error: "Unrecognized path", path: parsedBody.path }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = authHeader.slice(7);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return json({ error: "Invalid session" }, 401);
  }
  const sessionUserId = userData.user.id;

  if (ctx.userId && ctx.userId !== sessionUserId) {
    return json({ error: "Cannot access another user profile" }, 403);
  }

  const bundleRes = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
    op: "profile.get",
  });
  const envelope = bundleRes.data as Record<string, unknown>;
  const data = envelope?.data as Record<string, unknown> | undefined;
  const profile = data?.profile as Record<string, unknown> | undefined;
  const companyId =
    typeof profile?.company_id === "string" ? profile.company_id : null;
  if (!profile || !companyId) {
    return json({ error: "Profile not available" }, 403);
  }
  if (companyId !== ctx.tenantId) {
    return json({ error: "Tenant mismatch" }, 403);
  }

  const method = ctx.method;
  const path = parsedBody.path.trim();
  const body = parsedBody.body ?? {};
  const q = parsedBody.query ?? {};

  try {
    if (/profile$/i.test(path)) {
      if (method === "GET") {
        return json({
          data: {
            profile: data.profile ?? null,
            tenant: data.tenant ?? null,
          },
        });
      }
      if (method === "PATCH") {
        const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
          op: "profile.update",
          displayName: typeof body.displayName === "string" ? body.displayName : undefined,
          avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined,
          preferences:
            body.preferences && typeof body.preferences === "object"
              ? (body.preferences as Record<string, unknown>)
              : undefined,
          jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : undefined,
          department: typeof body.department === "string" ? body.department : undefined,
          contactInfo:
            body.contactInfo && typeof body.contactInfo === "object"
              ? (body.contactInfo as Record<string, unknown>)
              : undefined,
          bio: typeof body.bio === "string" ? body.bio : undefined,
        });
        return json(fwd.data, fwd.status);
      }
    }

    if (/auth-methods$/i.test(path) && method === "GET") {
      const methods = Array.isArray(profile.auth_methods)
        ? (profile.auth_methods as string[])
        : [];
      return json({
        data: {
          passwordEnabled: methods.map((m) => m.toLowerCase()).includes("password"),
          oauthEnabled: methods.some((m) => ["oauth", "google", "microsoft"].includes(m.toLowerCase())),
          methods,
          mfa: { totpEnabled: profile.totp_enabled === true },
        },
      });
    }

    if (/notifications$/i.test(path)) {
      const prefs = profile.preferences;
      if (method === "GET") {
        return json({ data: { preferences: prefs ?? {} } });
      }
      if (method === "PATCH") {
        const base =
          prefs && typeof prefs === "object" && !Array.isArray(prefs)
            ? { ...(prefs as Record<string, unknown>) }
            : {};
        const next =
          body.preferences && typeof body.preferences === "object" && !Array.isArray(body.preferences)
            ? { ...base, ...(body.preferences as Record<string, unknown>) }
            : base;
        const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
          op: "profile.update",
          preferences: next,
        });
        return json(fwd.data, fwd.status);
      }
    }

    if (/connections$/i.test(path) && !/\/connections\//i.test(path) && method === "GET") {
      const ext = Array.isArray(data.externalAccounts) ? data.externalAccounts : [];
      return json({ data: { items: ext } });
    }

    const patchConn =
      /^PATCH\s+\/tenants\/[^/]+\/users\/[^/]+\/connections\//i.test(parsedBody.path);
    if (patchConn) {
      const connectionId = ctx.connectionId;
      if (!connectionId || typeof connectionId !== "string") {
        return json({ error: "Missing connection id" }, 400);
      }
      const action = typeof body.action === "string" ? body.action : "disconnect";
      if (action !== "disconnect") {
        return json({ error: "Unsupported action" }, 400);
      }
      const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
        op: "connections.disconnect",
        connectionId,
      });
      return json(fwd.data, fwd.status);
    }

    if (/api-keys$/i.test(path) && !/\/api-keys\//i.test(path)) {
      if (method === "GET") {
        const keys = Array.isArray(data.apiKeys) ? data.apiKeys : [];
        return json({ data: { items: keys } });
      }
      if (method === "POST") {
        const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
          op: "apikeys.create",
          name: typeof body.name === "string" ? body.name : "API key",
          scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : undefined,
          expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
        });
        return json(fwd.data, fwd.status);
      }
    }

    const keySub = /^[A-Z]+\s+\/tenants\/[^/]+\/users\/[^/]+\/api-keys\//i.test(parsedBody.path);
    if (keySub) {
      const keyId = ctx.keyId;
      if (!keyId) return json({ error: "Missing key id" }, 400);
      if (method === "DELETE") {
        const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
          op: "apikeys.revoke",
          keyId,
        });
        return json(fwd.data, fwd.status);
      }
      if (method === "PATCH") {
        if (body.rotate === true) {
          const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
            op: "apikeys.rotate",
            keyId,
          });
          return json(fwd.data, fwd.status);
        }
        const fwd = await forwardAuthApi(supabaseUrl, anonKey, authHeader, {
          op: "apikeys.patch",
          keyId,
          name: typeof body.name === "string" ? body.name : undefined,
          scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : undefined,
        });
        return json(fwd.data, fwd.status);
      }
    }

    if (/activities$/i.test(path) && method === "GET") {
      const actor = typeof q.userId === "string" && q.userId ? q.userId : sessionUserId;
      if (actor !== sessionUserId) {
        return json({ error: "Activities are scoped to the signed-in user" }, 403);
      }
      const dateFrom = rangeToDateFrom(q.range);
      const eventTypes =
        typeof q.eventType === "string" && q.eventType.trim()
          ? [q.eventType.trim()]
          : undefined;
      const fwd = await forwardActivityLogsApi(supabaseUrl, anonKey, authHeader, {
        op: "activityLog.list",
        actorUserId: actor,
        dateFrom: dateFrom ?? undefined,
        eventTypes,
        limit: 80,
        offset: 0,
      });
      return json(fwd.data, fwd.status);
    }

    return json({ error: "Route not implemented" }, 501);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return json({ error: msg }, 500);
  }
});
