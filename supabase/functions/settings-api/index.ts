/**
 * Settings / Preferences hub — tenant data policies, settings audit, RBAC roles,
 * profile↔role assignments, tenant feature flags, builder API keys (hashed).
 * Client: supabase.functions.invoke('settings-api', { body: { op, ... } }).
 * Uses caller JWT + RLS; never returns key_hash; raw API key returned once on create.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("dataPolicy.get") }),
  z.object({
    op: z.literal("dataPolicy.patch"),
    retentionPeriodDays: z.number().int().min(0).max(36500).optional(),
    exportAllowed: z.boolean().optional(),
    purgeScheduled: z.boolean().optional(),
    auditConfig: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("settingsAudit.list"),
    limit: z.number().int().positive().max(200).optional(),
  }),
  z.object({
    op: z.literal("settingsAudit.append"),
    action: z.string().min(1).max(200),
    changes: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ op: z.literal("roles.list") }),
  z.object({
    op: z.literal("roles.create"),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string()).optional(),
  }),
  z.object({
    op: z.literal("roles.patch"),
    roleId: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    permissions: z.array(z.string()).optional(),
  }),
  z.object({ op: z.literal("roles.delete"), roleId: z.string().uuid() }),
  z.object({ op: z.literal("profileRoles.list"), profileId: z.string().uuid() }),
  z.object({
    op: z.literal("profileRoles.replace"),
    profileId: z.string().uuid(),
    roleIds: z.array(z.string().uuid()),
  }),
  z.object({ op: z.literal("profileRoles.listAll") }),
  z.object({ op: z.literal("profileRoles.listTenant") }),
  z.object({ op: z.literal("featureFlags.tenantList") }),
  z.object({
    op: z.literal("featureFlags.tenantUpsert"),
    flagKey: z.string().min(1).max(120),
    enabled: z.boolean(),
    rollout: z.number().int().min(0).max(100).optional(),
  }),
  z.object({
    op: z.literal("builderKeys.list"),
  }),
  z.object({
    op: z.literal("builderKeys.create"),
    name: z.string().min(1).max(120).optional(),
    scopes: z.array(z.string()).optional(),
    expiresInDays: z.number().int().positive().max(730).optional(),
  }),
  z.object({ op: z.literal("builderKeys.revoke"), keyId: z.string().uuid() }),
]);

type ParsedOp = z.infer<typeof opSchema>;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomApiKey(): string {
  const u = crypto.randomUUID().replace(/-/g, "");
  return `cai_${u}`;
}

async function requireUser(
  req: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { supabase, userId: user.id };
}

async function getCompanyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.company_id) return null;
  return data.company_id as string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function permissionsToJsonb(perms: string[] | undefined): unknown {
  const list = Array.isArray(perms) ? perms : [];
  return list;
}

function permissionsFromRow(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const body = await req.json().catch(() => null);
    const parsed = opSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
    }
    const op: ParsedOp = parsed.data;
    const companyId = await getCompanyId(supabase, userId);
    if (!companyId) {
      return json({ error: "No tenant context" }, 403);
    }

    switch (op.op) {
      case "dataPolicy.get": {
        const { data, error } = await supabase
          .from("tenant_data_policies")
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        return json({ data: data ?? null });
      }
      case "dataPolicy.patch": {
        const patch = {
          company_id: companyId,
          retention_period_days: op.retentionPeriodDays,
          export_allowed: op.exportAllowed,
          purge_scheduled: op.purgeScheduled,
          audit_config: op.auditConfig ?? undefined,
          updated_at: new Date().toISOString(),
        };
        const clean = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined),
        );
        const { data, error } = await supabase
          .from("tenant_data_policies")
          .upsert(clean, { onConflict: "company_id" })
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      case "settingsAudit.list": {
        const lim = op.limit ?? 80;
        const { data, error } = await supabase
          .from("settings_audit_log")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(lim);
        if (error) return json({ error: error.message }, 400);
        const list = Array.isArray(data) ? data : [];
        return json({ data: list });
      }
      case "settingsAudit.append": {
        const { error } = await supabase.from("settings_audit_log").insert({
          company_id: companyId,
          actor_user_id: userId,
          action: op.action,
          changes: op.changes ?? {},
        });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "roles.list": {
        const { data, error } = await supabase
          .from("roles")
          .select("*")
          .eq("company_id", companyId)
          .order("name");
        if (error) return json({ error: error.message }, 400);
        const rows = Array.isArray(data) ? data : [];
        return json({
          data: rows.map((r) => ({
            ...r,
            permissions: permissionsFromRow(
              r && typeof r === "object" && "permissions" in r
                ? (r as { permissions: unknown }).permissions
                : [],
            ),
          })),
        });
      }
      case "roles.create": {
        const { data, error } = await supabase
          .from("roles")
          .insert({
            company_id: companyId,
            name: op.name,
            description: op.description ?? "",
            permissions: permissionsToJsonb(op.permissions),
          })
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      case "roles.patch": {
        const patch: Record<string, unknown> = {};
        if (op.name !== undefined) patch.name = op.name;
        if (op.description !== undefined) patch.description = op.description;
        if (op.permissions !== undefined) {
          patch.permissions = permissionsToJsonb(op.permissions);
        }
        patch.updated_at = new Date().toISOString();
        const { data, error } = await supabase
          .from("roles")
          .update(patch)
          .eq("id", op.roleId)
          .eq("company_id", companyId)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      case "roles.delete": {
        const { error } = await supabase
          .from("roles")
          .delete()
          .eq("id", op.roleId)
          .eq("company_id", companyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "profileRoles.list": {
        const { data, error } = await supabase
          .from("profile_role_assignments")
          .select("role_id")
          .eq("profile_id", op.profileId);
        if (error) return json({ error: error.message }, 400);
        const ids = (Array.isArray(data) ? data : [])
          .map((x) =>
            x && typeof x === "object" && "role_id" in x &&
              typeof (x as { role_id: unknown }).role_id === "string"
              ? (x as { role_id: string }).role_id
              : null,
          )
          .filter((x): x is string => Boolean(x));
        return json({ data: ids });
      }
      case "profileRoles.replace": {
        const { error: delErr } = await supabase
          .from("profile_role_assignments")
          .delete()
          .eq("profile_id", op.profileId);
        if (delErr) return json({ error: delErr.message }, 400);
        const roleIds = Array.isArray(op.roleIds) ? op.roleIds : [];
        if (roleIds.length === 0) return json({ ok: true });
        const rows = roleIds.map((role_id) => ({
          profile_id: op.profileId,
          role_id,
        }));
        const { error: insErr } = await supabase
          .from("profile_role_assignments")
          .insert(rows);
        if (insErr) return json({ error: insErr.message }, 400);
        return json({ ok: true });
      }
      case "profileRoles.listAll": {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId);
        if (pe) return json({ error: pe.message }, 400);
        const profileIds = (Array.isArray(profs) ? profs : [])
          .map((p) =>
            p && typeof p === "object" && "id" in p && typeof (p as { id: unknown }).id === "string"
              ? (p as { id: string }).id
              : null,
          )
          .filter((x): x is string => Boolean(x));
        if (profileIds.length === 0) return json({ data: [] });
        const { data: assigns, error: ae } = await supabase
          .from("profile_role_assignments")
          .select("profile_id, role_id")
          .in("profile_id", profileIds);
        if (ae) return json({ error: ae.message }, 400);
        const list = Array.isArray(assigns) ? assigns : [];
        return json({ data: list });
      }
      case "profileRoles.listTenant": {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", companyId);
        if (pe) return json({ error: pe.message }, 400);
        const ids = (Array.isArray(profs) ? profs : [])
          .map((p) =>
            p && typeof p === "object" && "id" in p && typeof (p as { id: unknown }).id === "string"
              ? (p as { id: string }).id
              : null,
          )
          .filter((x): x is string => Boolean(x));
        if (ids.length === 0) return json({ data: [] });
        const { data: assigns, error: ae } = await supabase
          .from("profile_role_assignments")
          .select("profile_id, role_id")
          .in("profile_id", ids);
        if (ae) return json({ error: ae.message }, 400);
        return json({ data: Array.isArray(assigns) ? assigns : [] });
      }
      case "featureFlags.tenantList": {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("*")
          .eq("company_id", companyId)
          .order("flag_key");
        if (error) return json({ error: error.message }, 400);
        return json({ data: Array.isArray(data) ? data : [] });
      }
      case "featureFlags.tenantUpsert": {
        const { data: existing, error: findErr } = await supabase
          .from("feature_flags")
          .select("id")
          .eq("company_id", companyId)
          .eq("flag_key", op.flagKey)
          .maybeSingle();
        if (findErr) return json({ error: findErr.message }, 400);
        const rollout = op.rollout ?? 100;
        const now = new Date().toISOString();
        if (existing?.id) {
          const { data, error } = await supabase
            .from("feature_flags")
            .update({
              enabled: op.enabled,
              rollout,
              updated_at: now,
            })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) return json({ error: error.message }, 400);
          return json({ data });
        }
        const { data, error } = await supabase
          .from("feature_flags")
          .insert({
            flag_key: op.flagKey,
            company_id: companyId,
            enabled: op.enabled,
            rollout,
            payload: {},
            updated_at: now,
          })
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      case "builderKeys.list": {
        const { data, error } = await supabase
          .from("builder_api_keys")
          .select("id, company_id, profile_id, name, key_prefix, scopes, expires_at, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ data: Array.isArray(data) ? data : [] });
      }
      case "builderKeys.create": {
        const raw = randomApiKey();
        const prefix = raw.slice(0, 12);
        const hash = await sha256Hex(raw);
        const expiresAt = op.expiresInDays
          ? new Date(Date.now() + op.expiresInDays * 86400000).toISOString()
          : null;
        const { data, error } = await supabase
          .from("builder_api_keys")
          .insert({
            company_id: companyId,
            profile_id: userId,
            name: op.name ?? "API key",
            key_prefix: prefix,
            key_hash: hash,
            scopes: Array.isArray(op.scopes) ? op.scopes : [],
            expires_at: expiresAt,
          })
          .select("id, name, key_prefix, scopes, expires_at, created_at")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ data: { ...data, secret: raw } });
      }
      case "builderKeys.revoke": {
        const { error } = await supabase
          .from("builder_api_keys")
          .delete()
          .eq("id", op.keyId)
          .eq("company_id", companyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
