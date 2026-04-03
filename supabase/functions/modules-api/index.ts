/**
 * Internal Module / Template Builder — Edge API aligned with `src/api/modules.ts`.
 * Client: supabase.functions.invoke('modules-api', { body: { op, ... } }).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const dataBindingSchema = z.object({
  bindingName: z.string().min(1).max(160),
  sourceContext: z.string().min(1).max(160),
  targetEntity: z.string().min(1).max(160),
  fieldMappings: z.record(z.string()).default({}),
});

const permissionRowSchema = z.object({
  roleId: z.string().uuid(),
  actions: z.array(z.string()).default([]),
  scope: z.string().max(120).optional(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("modules.list"),
    status: z.string().optional(),
    search: z.string().optional(),
    tag: z.string().optional(),
  }),
  z.object({ op: z.literal("modules.get"), id: z.string().uuid() }),
  z.object({
    op: z.literal("modules.create"),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    ui_entry: z.string().max(500).optional(),
    status: z.enum(["draft", "published", "deprecated", "archived"]).optional(),
    tenant_scope: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    data_bindings: z.array(dataBindingSchema).optional(),
    permissions: z.array(permissionRowSchema).optional(),
  }),
  z.object({
    op: z.literal("modules.update"),
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional(),
    ui_entry: z.string().max(500).optional(),
    status: z.enum(["draft", "published", "deprecated", "archived"]).optional(),
    tenant_scope: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    data_bindings: z.array(dataBindingSchema).optional(),
    permissions: z.array(permissionRowSchema).optional(),
  }),
  z.object({ op: z.literal("modules.delete"), id: z.string().uuid() }),
  z.object({
    op: z.literal("modules.versions.list"),
    moduleId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("modules.versions.publish"),
    moduleId: z.string().uuid(),
    versionTag: z.string().min(1).max(80),
    changelog: z.string().max(4000).optional(),
    migrationNotes: z.string().max(4000).optional(),
    bindingDiff: z.record(z.unknown()).optional(),
  }),
  z.object({
    op: z.literal("modules.rollback"),
    moduleId: z.string().uuid(),
    versionId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("modules.deploy"),
    moduleId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("templates.install"),
    templateId: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
  }),
  z.object({ op: z.literal("templates.list") }),
  z.object({
    op: z.literal("modules.departments.set"),
    moduleId: z.string().uuid(),
    bindings: z.array(
      z.object({
        departmentId: z.string().uuid(),
        accessLevel: z.enum(["read", "write", "admin"]),
      }),
    ),
  }),
  z.object({
    op: z.literal("modules.permissions.put"),
    moduleId: z.string().uuid(),
    permissions: z.array(permissionRowSchema),
  }),
  z.object({
    op: z.literal("modules.permissions.get"),
    moduleId: z.string().uuid(),
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

function assertCompany(companyId: string | null): asserts companyId is string {
  if (!companyId) {
    throw new Response(JSON.stringify({ error: "Profile missing company" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function canMutateModules(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) => ["admin", "owner", "manager", "builder"].includes(x));
}

function normalizeStatus(s: string): string {
  const lower = s.toLowerCase();
  if (["draft", "published", "deprecated", "archived"].includes(lower)) {
    return lower;
  }
  return s;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function buildSnapshot(mod: Record<string, unknown>) {
  return {
    name: String(mod.name ?? ""),
    description: String(mod.description ?? ""),
    ui_entry: String(mod.ui_entry ?? ""),
    data_bindings: Array.isArray(mod.data_bindings) ? mod.data_bindings : [],
    permissions: Array.isArray(mod.permissions) ? mod.permissions : [],
    tags: asStringArray(mod.tags),
    tenant_scope: asStringArray(mod.tenant_scope).length
      ? asStringArray(mod.tenant_scope)
      : ["current_tenant"],
  };
}

async function logActivity(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  eventType: string,
  moduleId: string,
  payload: Record<string, unknown>,
) {
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    event_type: eventType,
    actor_user_id: userId,
    payload,
    related_entity: "internal_module",
    related_id: moduleId,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }
    const op: ParsedOp = parsed.data;
    const { company_id, roles } = await loadProfile(supabase, userId);
    assertCompany(company_id);

    switch (op.op) {
      case "modules.list": {
        const { data, error } = await supabase
          .from("internal_modules")
          .select("*")
          .eq("company_id", company_id)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        let rows = Array.isArray(data) ? data : [];
        if (op.status) {
          rows = rows.filter((r) =>
            normalizeStatus(String(r.status)) === normalizeStatus(op.status!)
          );
        }
        if (op.search?.trim()) {
          const q = op.search.trim().toLowerCase();
          rows = rows.filter((r) =>
            String(r.name).toLowerCase().includes(q)
          );
        }
        const tagNeedle = op.tag?.trim().toLowerCase();
        if (tagNeedle) {
          rows = rows.filter((r) => {
            const tags = Array.isArray(r.tags) ? r.tags as string[] : [];
            return tags.some((t) => String(t).toLowerCase().includes(tagNeedle));
          });
        }

        const enriched = await Promise.all(
          rows.map(async (r) => {
            let active_version: string | null = null;
            if (r.active_version_id) {
              const { data: v } = await supabase
                .from("module_versions")
                .select("version_tag")
                .eq("id", r.active_version_id)
                .maybeSingle();
              active_version = v?.version_tag ?? null;
            }
            return { ...r, active_version };
          }),
        );

        return json({ data: enriched });
      }

      case "modules.get": {
        const { data: mod, error: e1 } = await supabase
          .from("internal_modules")
          .select("*")
          .eq("id", op.id)
          .eq("company_id", company_id)
          .maybeSingle();
        if (e1) throw e1;
        if (!mod) return json({ error: "Not found" }, 404);

        const { data: vers, error: e2 } = await supabase
          .from("module_versions")
          .select("*")
          .eq("module_id", op.id)
          .order("created_at", { ascending: false });
        if (e2) throw e2;

        const { data: dbs, error: e3 } = await supabase
          .from("module_department_access")
          .select("id, department_id, access_level, created_at")
          .eq("module_id", op.id);
        if (e3) throw e3;

        return json({
          data: {
            module: mod,
            versions: Array.isArray(vers) ? vers : [],
            departmentBindings: Array.isArray(dbs) ? dbs : [],
          },
        });
      }

      case "modules.create": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: clash } = await supabase
          .from("internal_modules")
          .select("id")
          .eq("company_id", company_id)
          .eq("name", op.name)
          .maybeSingle();
        if (clash) {
          return json({ error: "Module name must be unique for this tenant" }, 409);
        }

        const tenant_scope = op.tenant_scope && op.tenant_scope.length > 0
          ? op.tenant_scope
          : ["current_tenant"];
        const tags = op.tags ?? [];
        const data_bindings = op.data_bindings ?? [];
        const permissions = (op.permissions ?? []).map((p) => ({
          roleId: p.roleId,
          actions: p.actions ?? [],
          scope: p.scope ?? "module",
        }));

        const { data: created, error: ce } = await supabase
          .from("internal_modules")
          .insert({
            company_id,
            name: op.name,
            description: op.description ?? "",
            ui_entry: op.ui_entry ?? "/dashboard/modules/preview",
            status: normalizeStatus(op.status ?? "draft"),
            tenant_scope,
            tags,
            data_bindings,
            permissions,
          })
          .select("*")
          .single();
        if (ce) throw ce;

        const snap = buildSnapshot(created as Record<string, unknown>);
        const { data: ver, error: ve } = await supabase
          .from("module_versions")
          .insert({
            module_id: created.id,
            version_tag: "1.0.0",
            changelog: "Initial version",
            is_active: true,
            migration_notes: null,
            binding_diff: {},
            snapshot: snap,
          })
          .select("id")
          .single();
        if (ve) throw ve;

        await supabase
          .from("internal_modules")
          .update({ active_version_id: ver.id })
          .eq("id", created.id);

        await logActivity(supabase, company_id, userId, "module.created", created.id, {
          name: created.name,
        });

        const { data: final } = await supabase
          .from("internal_modules")
          .select("*")
          .eq("id", created.id)
          .single();

        return json({ data: final });
      }

      case "modules.update": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: before } = await supabase
          .from("internal_modules")
          .select("data_bindings")
          .eq("id", op.id)
          .eq("company_id", company_id)
          .maybeSingle();
        if (!before) return json({ error: "Not found" }, 404);

        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (op.name !== undefined) patch.name = op.name;
        if (op.description !== undefined) patch.description = op.description;
        if (op.ui_entry !== undefined) patch.ui_entry = op.ui_entry;
        if (op.status !== undefined) patch.status = normalizeStatus(op.status);
        if (op.tenant_scope !== undefined) patch.tenant_scope = op.tenant_scope;
        if (op.tags !== undefined) patch.tags = op.tags;
        if (op.data_bindings !== undefined) patch.data_bindings = op.data_bindings;
        if (op.permissions !== undefined) {
          patch.permissions = (op.permissions ?? []).map((p) => ({
            roleId: p.roleId,
            actions: p.actions ?? [],
            scope: p.scope ?? "module",
          }));
        }

        let migrationHint: string | null = null;
        if (op.data_bindings !== undefined) {
          const prev = JSON.stringify(before.data_bindings ?? []);
          const next = JSON.stringify(op.data_bindings ?? []);
          if (prev !== next) {
            migrationHint =
              "Data bindings changed — validate downstream consumers and publish a new version when ready.";
          }
        }

        const { data: updated, error } = await supabase
          .from("internal_modules")
          .update(patch)
          .eq("id", op.id)
          .eq("company_id", company_id)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!updated) return json({ error: "Not found" }, 404);

        await logActivity(supabase, company_id, userId, "module.updated", op.id, {
          keys: Object.keys(patch),
        });

        return json({ data: { module: updated, migrationHint } });
      }

      case "modules.delete": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { error } = await supabase
          .from("internal_modules")
          .delete()
          .eq("id", op.id)
          .eq("company_id", company_id);
        if (error) throw error;
        await logActivity(supabase, company_id, userId, "module.deleted", op.id, {});
        return json({ data: { ok: true } });
      }

      case "modules.versions.list": {
        const { data, error } = await supabase
          .from("module_versions")
          .select("*")
          .eq("module_id", op.moduleId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ data: Array.isArray(data) ? data : [] });
      }

      case "modules.versions.publish": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: mod } = await supabase
          .from("internal_modules")
          .select("*")
          .eq("id", op.moduleId)
          .eq("company_id", company_id)
          .maybeSingle();
        if (!mod) return json({ error: "Not found" }, 404);

        await supabase
          .from("module_versions")
          .update({ is_active: false })
          .eq("module_id", op.moduleId);

        const snap = buildSnapshot(mod as Record<string, unknown>);
        const { data: ver, error } = await supabase
          .from("module_versions")
          .insert({
            module_id: op.moduleId,
            version_tag: op.versionTag,
            changelog: op.changelog ?? "",
            is_active: true,
            migration_notes: op.migrationNotes ?? null,
            binding_diff: op.bindingDiff ?? {},
            snapshot: snap,
          })
          .select("*")
          .single();
        if (error) throw error;

        await supabase
          .from("internal_modules")
          .update({ active_version_id: ver.id, updated_at: new Date().toISOString() })
          .eq("id", op.moduleId);

        await logActivity(supabase, company_id, userId, "module.version_published", op.moduleId, {
          versionTag: op.versionTag,
        });

        return json({ data: ver });
      }

      case "modules.rollback": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: target, error: e1 } = await supabase
          .from("module_versions")
          .select("*")
          .eq("id", op.versionId)
          .eq("module_id", op.moduleId)
          .maybeSingle();
        if (e1) throw e1;
        if (!target) return json({ error: "Version not found" }, 404);

        const snap = target.snapshot as Record<string, unknown> | null;
        if (!snap || typeof snap !== "object") {
          return json({ error: "Invalid snapshot" }, 400);
        }

        const patch = {
          name: String(snap.name ?? ""),
          description: String(snap.description ?? ""),
          ui_entry: String(snap.ui_entry ?? ""),
          data_bindings: Array.isArray(snap.data_bindings) ? snap.data_bindings : [],
          permissions: Array.isArray(snap.permissions) ? snap.permissions : [],
          tags: asStringArray(snap.tags),
          tenant_scope: asStringArray(snap.tenant_scope).length
            ? asStringArray(snap.tenant_scope)
            : ["current_tenant"],
          updated_at: new Date().toISOString(),
        };

        const { error: e2 } = await supabase
          .from("internal_modules")
          .update(patch)
          .eq("id", op.moduleId)
          .eq("company_id", company_id);
        if (e2) throw e2;

        await supabase
          .from("module_versions")
          .update({ is_active: false })
          .eq("module_id", op.moduleId);
        await supabase
          .from("module_versions")
          .update({ is_active: true })
          .eq("id", op.versionId);

        await supabase
          .from("internal_modules")
          .update({ active_version_id: op.versionId })
          .eq("id", op.moduleId);

        await logActivity(supabase, company_id, userId, "module.rollback", op.moduleId, {
          versionId: op.versionId,
        });

        const steps = [
          `Restored manifest from ${target.version_tag}.`,
          String(target.migration_notes ?? "Review permissions and department access."),
        ];
        return json({
          data: {
            ok: true,
            migrationPlan: { steps, versionTag: target.version_tag },
          },
        });
      }

      case "modules.deploy": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: updated, error } = await supabase
          .from("internal_modules")
          .update({
            status: "published",
            last_deployed_at: new Date().toISOString(),
            health_status: "healthy",
            updated_at: new Date().toISOString(),
          })
          .eq("id", op.moduleId)
          .eq("company_id", company_id)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!updated) return json({ error: "Not found" }, 404);
        await logActivity(supabase, company_id, userId, "module.deployed", op.moduleId, {});
        return json({ data: updated });
      }

      case "templates.list": {
        const { data, error } = await supabase
          .from("module_templates")
          .select("*")
          .or(`company_id.is.null,company_id.eq.${company_id}`)
          .order("name");
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        const shaped = list.map((t) => ({
          id: t.id,
          slug: t.slug ?? "",
          name: t.name,
          description: t.description ?? "",
          preview_ui: t.preview_ui,
          bindings_template: t.bindings_template ?? [],
          dependencies: t.dependencies ?? [],
          default_ui_entry: t.default_ui_entry ?? "/dashboard/modules/preview",
          created_at: t.created_at,
        }));
        return json({ data: shaped });
      }

      case "templates.install": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: tpl, error: te } = await supabase
          .from("module_templates")
          .select("*")
          .eq("id", op.templateId)
          .maybeSingle();
        if (te) throw te;
        if (!tpl) return json({ error: "Template not found" }, 404);
        if (tpl.company_id !== null && tpl.company_id !== company_id) {
          return json({ error: "Forbidden" }, 403);
        }

        const modName = op.name?.trim() || tpl.name;
        const { data: clash } = await supabase
          .from("internal_modules")
          .select("id")
          .eq("company_id", company_id)
          .eq("name", modName)
          .maybeSingle();
        if (clash) {
          return json({ error: "A module with this name already exists" }, 409);
        }

        const bindings = Array.isArray(tpl.bindings_template)
          ? tpl.bindings_template
          : [];
        const uiEntry = tpl.default_ui_entry || tpl.preview_ui ||
          "/dashboard/modules/preview";

        const { data: created, error: ce } = await supabase
          .from("internal_modules")
          .insert({
            company_id,
            name: modName,
            description: tpl.description ?? "",
            ui_entry: uiEntry,
            status: "draft",
            tenant_scope: ["current_tenant"],
            tags: ["marketplace"],
            data_bindings: bindings,
            permissions: [],
            marketplace_template_id: tpl.id,
            installed_from_template: true,
          })
          .select("*")
          .single();
        if (ce) throw ce;

        const snap = buildSnapshot(created as Record<string, unknown>);
        const { data: ver, error: ve } = await supabase
          .from("module_versions")
          .insert({
            module_id: created.id,
            version_tag: "1.0.0",
            changelog: "Installed from marketplace template",
            is_active: true,
            migration_notes: "Verify connector dependencies before publish.",
            binding_diff: {},
            snapshot: snap,
          })
          .select("id")
          .single();
        if (ve) throw ve;

        await supabase
          .from("internal_modules")
          .update({ active_version_id: ver.id })
          .eq("id", created.id);

        await logActivity(supabase, company_id, userId, "module.installed", created.id, {
          templateId: op.templateId,
        });

        const { data: final } = await supabase
          .from("internal_modules")
          .select("*")
          .eq("id", created.id)
          .single();

        return json({ data: final });
      }

      case "modules.departments.set": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const { data: mod } = await supabase
          .from("internal_modules")
          .select("id")
          .eq("id", op.moduleId)
          .eq("company_id", company_id)
          .maybeSingle();
        if (!mod) return json({ error: "Not found" }, 404);

        await supabase.from("module_department_access").delete().eq(
          "module_id",
          op.moduleId,
        );
        const binds = op.bindings ?? [];
        if (binds.length > 0) {
          const rows = binds.map((b) => ({
            module_id: op.moduleId,
            department_id: b.departmentId,
            access_level: b.accessLevel,
          }));
          const { error } = await supabase.from("module_department_access").insert(rows);
          if (error) throw error;
        }
        await logActivity(supabase, company_id, userId, "module.departments_set", op.moduleId, {
          count: binds.length,
        });
        return json({ data: { ok: true } });
      }

      case "modules.permissions.put": {
        if (!canMutateModules(roles)) return json({ error: "Forbidden" }, 403);
        const perms = (op.permissions ?? []).map((p) => ({
          roleId: p.roleId,
          actions: p.actions ?? [],
          scope: p.scope ?? "module",
        }));
        const { data: updated, error } = await supabase
          .from("internal_modules")
          .update({
            permissions: perms,
            updated_at: new Date().toISOString(),
          })
          .eq("id", op.moduleId)
          .eq("company_id", company_id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!updated) return json({ error: "Not found" }, 404);
        await logActivity(supabase, company_id, userId, "module.permissions_put", op.moduleId, {
          count: perms.length,
        });
        return json({ data: { ok: true } });
      }

      case "modules.permissions.get": {
        const { data: mod, error } = await supabase
          .from("internal_modules")
          .select("permissions")
          .eq("id", op.moduleId)
          .eq("company_id", company_id)
          .maybeSingle();
        if (error) throw error;
        if (!mod) return json({ error: "Not found" }, 404);
        const p = Array.isArray(mod.permissions) ? mod.permissions : [];
        return json({ data: p });
      }

      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("modules-api error", e);
    return json(
      { error: e instanceof Error ? e.message : "Internal error" },
      500,
    );
  }
});
