/**
 * Multi-tenant company module — tenant lifecycle, tenant_configs, onboarding templates, company setup completion.
 * Client: supabase.functions.invoke('tenants-api', { body: { op, ... } }).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY; SUPABASE_SERVICE_ROLE_KEY for super_admin cross-tenant operations.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { redactPayloadJson } from "../_shared/activity-log-redact.ts";

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("tenants.admin.list"),
    search: z.string().max(200).optional(),
    tenantStatus: z.enum(["active", "suspended", "deprovisioned", "provisioning"]).optional(),
    region: z.string().max(80).optional(),
    plan: z.string().max(80).optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({
    op: z.literal("tenants.admin.get"),
    companyId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("tenants.admin.create"),
    name: z.string().min(1).max(200),
    region: z.string().max(80).optional(),
    plan: z.string().max(80).optional(),
    timezone: z.string().max(80).optional(),
    currency: z.string().max(8).optional(),
    domain: z.string().max(200).optional(),
    legalName: z.string().max(200).optional(),
    displayName: z.string().max(200).optional(),
    country: z.string().max(120).optional(),
    maxUsers: z.number().int().positive().max(100000).optional(),
    maxIntegrations: z.number().int().positive().max(500).optional(),
  }),
  z.object({
    op: z.literal("tenants.admin.patch"),
    companyId: z.string().uuid(),
    name: z.string().max(200).optional(),
    region: z.string().max(80).optional(),
    plan: z.string().max(80).optional(),
    timezone: z.string().max(80).optional(),
    currency: z.string().max(8).optional(),
    domain: z.string().max(200).nullable().optional(),
    tenantStatus: z.enum(["active", "suspended", "deprovisioned", "provisioning"]).optional(),
    legalName: z.string().max(200).nullable().optional(),
    displayName: z.string().max(200).nullable().optional(),
    country: z.string().max(120).nullable().optional(),
  }),
  z.object({
    op: z.literal("tenants.admin.deprovision"),
    companyId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("tenants.admin.bulkDeprovision"),
    companyIds: z.array(z.string().uuid()).min(1).max(50),
  }),
  z.object({
    op: z.literal("tenants.admin.integrationMonitor"),
    companyId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("tenants.config.list"),
    companyId: z.string().uuid().optional(),
  }),
  z.object({
    op: z.literal("tenants.config.upsert"),
    companyId: z.string().uuid().optional(),
    configKey: z.string().min(1).max(120),
    configValue: z.record(z.unknown()).default({}),
  }),
  z.object({
    op: z.literal("onboarding.templates.list"),
    templateType: z.enum(["onboarding", "system"]).optional(),
  }),
  z.object({
    op: z.literal("onboarding.templates.upsert"),
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    templateType: z.enum(["onboarding", "system"]).default("onboarding"),
    version: z.number().int().positive().max(9999).optional(),
    data: z.record(z.unknown()).default({}),
    isActive: z.boolean().optional(),
    tenantId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    op: z.literal("onboarding.templates.delete"),
    id: z.string().uuid(),
  }),
  z.object({ op: z.literal("onboarding.templates.adminList") }),
  z.object({
    op: z.literal("onboarding.integrations.suggestions"),
  }),
  z.object({
    op: z.literal("onboarding.company.apply"),
    legalName: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200),
    country: z.string().max(120).optional(),
    timezone: z.string().max(80),
    currency: z.string().max(8),
    departmentNames: z.array(z.string().min(1).max(120)).min(1).max(40),
    templateId: z.string().uuid().optional(),
    suggestedIntegrationKeys: z.array(z.string().max(80)).max(20).optional(),
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    region: z.string().max(120).optional(),
    postalCode: z.string().max(32).optional(),
    website: z.string().max(500).optional(),
    logoUrl: z.string().max(2000).optional(),
    taxId: z.string().max(80).optional(),
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

function normalizeRoles(roles: string[]): string[] {
  return roles.map((r) => String(r).toLowerCase());
}

function isSuperAdmin(roles: string[]): boolean {
  return normalizeRoles(roles).includes("super_admin");
}

function isPlatformAuditor(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.some((x) => ["compliance_auditor", "auditor"].includes(x));
}

function canTenantsAdminRead(roles: string[]): boolean {
  return isSuperAdmin(roles) || isPlatformAuditor(roles);
}

function isCompanyAdmin(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.some((x) =>
    ["owner", "company_admin", "admin", "super_admin"].includes(x)
  );
}

async function logAdminAction(
  admin: SupabaseClient,
  params: {
    companyId: string;
    actorUserId: string;
    action: string;
    payload: Record<string, unknown>;
  },
) {
  const auditPayload = { action: params.action, ...params.payload };
  await admin.from("activity_logs").insert({
    company_id: params.companyId,
    event_type: "admin_action",
    actor_user_id: params.actorUserId,
    payload: auditPayload,
    redacted_payload: redactPayloadJson(auditPayload) as Record<string, unknown>,
    metadata: { source: "tenants-api" },
  });
}

async function handleSuperAdmin(
  admin: SupabaseClient,
  userId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const auditorOnly = isPlatformAuditor(roles) && !isSuperAdmin(roles);
  const mutateOps: ParsedOp["op"][] = [
    "tenants.admin.create",
    "tenants.admin.patch",
    "tenants.admin.deprovision",
    "tenants.admin.bulkDeprovision",
    "onboarding.templates.upsert",
    "onboarding.templates.delete",
  ];
  if (auditorOnly && mutateOps.includes(body.op)) {
    return json({ error: "Forbidden" }, 403);
  }

  switch (body.op) {
    case "tenants.admin.list": {
      const limit = body.limit ?? 25;
      const offset = body.offset ?? 0;
      let q = admin.from("companies").select("*", { count: "exact" });
      if (body.search?.trim()) {
        const safe = body.search.trim().replace(/[%*,()]/g, "");
        const s = `%${safe}%`;
        q = q.or(`name.ilike.${s},legal_name.ilike.${s},display_name.ilike.${s}`);
      }
      if (body.tenantStatus) q = q.eq("tenant_status", body.tenantStatus);
      if (body.region) q = q.eq("region", body.region);
      if (body.plan) q = q.eq("plan", body.plan);
      q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      const { data, error, count } = await q;
      if (error) return json({ error: error.message }, 500);
      const rows = Array.isArray(data) ? data : [];
      return json({
        data: rows,
        total: typeof count === "number" ? count : rows.length,
      });
    }
    case "tenants.admin.get": {
      const { data, error } = await admin.from("companies").select("*").eq("id", body.companyId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }
    case "tenants.admin.create": {
      const settings: Record<string, unknown> = {};
      if (typeof body.maxUsers === "number") settings.maxUsers = body.maxUsers;
      if (typeof body.maxIntegrations === "number") {
        settings.maxIntegrations = body.maxIntegrations;
      }
      const row = {
        name: body.name,
        region: body.region ?? "us",
        plan: body.plan ?? "trial",
        tenant_status: "active" as const,
        timezone: body.timezone ?? "UTC",
        currency: body.currency ?? "USD",
        domain: body.domain ?? null,
        legal_name: body.legalName ?? null,
        display_name: body.displayName ?? body.name,
        country: body.country ?? null,
        settings: Object.keys(settings).length > 0 ? settings : {},
      };
      const { data, error } = await admin.from("companies").insert(row).select("*").single();
      if (error) return json({ error: error.message }, 400);
      await logAdminAction(admin, {
        companyId: data.id as string,
        actorUserId: userId,
        action: "tenants.create",
        payload: { companyId: data.id, name: body.name },
      });
      return json({ data });
    }
    case "tenants.admin.patch": {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.region !== undefined) patch.region = body.region;
      if (body.plan !== undefined) patch.plan = body.plan;
      if (body.timezone !== undefined) patch.timezone = body.timezone;
      if (body.currency !== undefined) patch.currency = body.currency;
      if (body.domain !== undefined) patch.domain = body.domain;
      if (body.tenantStatus !== undefined) patch.tenant_status = body.tenantStatus;
      if (body.legalName !== undefined) patch.legal_name = body.legalName;
      if (body.displayName !== undefined) patch.display_name = body.displayName;
      if (body.country !== undefined) patch.country = body.country;
      const { data, error } = await admin.from("companies").update(patch).eq("id", body.companyId)
        .select("*").single();
      if (error) return json({ error: error.message }, 400);
      await logAdminAction(admin, {
        companyId: body.companyId,
        actorUserId: userId,
        action: "tenants.patch",
        payload: { companyId: body.companyId, patch },
      });
      return json({ data });
    }
    case "tenants.admin.deprovision": {
      const { data, error } = await admin.from("companies").update({
        tenant_status: "deprovisioned",
        updated_at: new Date().toISOString(),
      }).eq("id", body.companyId).select("*").single();
      if (error) return json({ error: error.message }, 400);
      await logAdminAction(admin, {
        companyId: body.companyId,
        actorUserId: userId,
        action: "tenants.deprovision",
        payload: { companyId: body.companyId },
      });
      return json({ data });
    }
    case "tenants.admin.bulkDeprovision": {
      const results: { id: string; ok: boolean; error?: string }[] = [];
      for (const id of body.companyIds) {
        const { error } = await admin.from("companies").update({
          tenant_status: "deprovisioned",
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (error) results.push({ id, ok: false, error: error.message });
        else {
          results.push({ id, ok: true });
          await logAdminAction(admin, {
            companyId: id,
            actorUserId: userId,
            action: "tenants.deprovision",
            payload: { companyId: id, bulk: true },
          });
        }
      }
      return json({ data: results });
    }
    case "onboarding.templates.adminList": {
      const { data, error } = await admin
        .from("onboarding_templates")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "tenants.admin.integrationMonitor": {
      const cid = body.companyId;
      const { data: connectors, error: cErr } = await admin
        .from("connectors")
        .select("id, provider_key, status, last_sync_at")
        .eq("company_id", cid);
      if (cErr) return json({ error: cErr.message }, 500);
      return json({
        data: {
          connectors: Array.isArray(connectors) ? connectors : [],
        },
      });
    }
    case "onboarding.templates.upsert": {
      const now = new Date().toISOString();
      const base = {
        name: body.name,
        template_type: body.templateType,
        version: body.version ?? 1,
        data: body.data,
        is_active: body.isActive ?? true,
        tenant_id: body.tenantId ?? null,
        updated_at: now,
      };
      if (body.id) {
        const { data, error } = await admin.from("onboarding_templates").update(base).eq("id", body.id)
          .select("*").single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      const { data, error } = await admin.from("onboarding_templates").insert({
        ...base,
        created_by: userId,
        created_at: now,
      }).select("*").single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "onboarding.templates.delete": {
      const { error } = await admin.from("onboarding_templates").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ok: true } });
    }
    default:
      return json({ error: "Unhandled super admin op" }, 400);
  }
}

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const superUser = isSuperAdmin(roles);

  switch (body.op) {
    case "tenants.config.list": {
      const target = superUser && body.companyId ? body.companyId : companyId;
      if (!target) return json({ error: "Missing company" }, 400);
      if (!superUser && target !== companyId) return json({ error: "Forbidden" }, 403);
      const { data, error } = await supabase.from("tenant_configs").select("*").eq(
        "company_id",
        target,
      ).order("config_key", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "tenants.config.upsert": {
      if (!isCompanyAdmin(roles)) return json({ error: "Forbidden" }, 403);
      const target = superUser && body.companyId ? body.companyId : companyId;
      if (!target) return json({ error: "Missing company" }, 400);
      if (!superUser && target !== companyId) return json({ error: "Forbidden" }, 403);
      const now = new Date().toISOString();
      const row = {
        company_id: target,
        config_key: body.configKey,
        config_value: body.configValue,
        updated_at: now,
      };
      const { data: existing } = await supabase.from("tenant_configs").select("id").eq(
        "company_id",
        target,
      ).eq("config_key", body.configKey).maybeSingle();
      let result;
      if (existing?.id) {
        const { data, error } = await supabase.from("tenant_configs").update(row).eq("id", existing.id)
          .select("*").single();
        if (error) return json({ error: error.message }, 400);
        result = data;
      } else {
        const { data, error } = await supabase.from("tenant_configs").insert({
          ...row,
          created_at: now,
        }).select("*").single();
        if (error) return json({ error: error.message }, 400);
        result = data;
      }
      return json({ data: result });
    }
    case "onboarding.templates.list": {
      let q = supabase.from("onboarding_templates").select("*").eq("is_active", true);
      if (body.templateType) q = q.eq("template_type", body.templateType);
      const { data, error } = await q.order("name", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      const list = Array.isArray(data) ? data : [];
      return json({ data: list });
    }
    case "onboarding.integrations.suggestions": {
      const catalog: {
        provider: string;
        label: string;
        type: "OAuth" | "APIKey";
        sampleMappings: Record<string, string>;
      }[] = [
        {
          provider: "slack",
          label: "Slack",
          type: "OAuth",
          sampleMappings: { "channel.id": "Conversation.externalId", "message.text": "Message.body" },
        },
        {
          provider: "hubspot",
          label: "HubSpot",
          type: "OAuth",
          sampleMappings: { "contact.email": "Contact.email", "deal.dealstage": "Opportunity.stage" },
        },
        {
          provider: "google_drive",
          label: "Google Drive",
          type: "OAuth",
          sampleMappings: { "file.id": "Document.externalId", "file.name": "Document.title" },
        },
        {
          provider: "gmail",
          label: "Gmail",
          type: "OAuth",
          sampleMappings: { "message.id": "Message.externalId", "message.subject": "Message.title" },
        },
        {
          provider: "google_calendar",
          label: "Google Calendar",
          type: "OAuth",
          sampleMappings: { "event.id": "Activity.externalId", "event.summary": "Activity.title" },
        },
        {
          provider: "quickbooks",
          label: "QuickBooks",
          type: "OAuth",
          sampleMappings: { "Invoice.Id": "Document.externalId", "Line.Amount": "Opportunity.amount" },
        },
        {
          provider: "clickup",
          label: "ClickUp",
          type: "OAuth",
          sampleMappings: { "team.id": "Workspace.externalId", "task.name": "Task.title" },
        },
      ];
      const { data: connRows } = await supabase
        .from("connectors")
        .select("provider_key, status")
        .eq("company_id", companyId);
      const connected = new Set<string>();
      for (const r of Array.isArray(connRows) ? connRows : []) {
        const row = r as { provider_key?: string; status?: string };
        const st = String(row.status ?? "").toLowerCase();
        if (["connected", "healthy", "active"].includes(st)) {
          if (row.provider_key) connected.add(row.provider_key);
        }
      }
      const data = catalog.map((c) => ({
        provider: c.provider,
        label: c.label,
        type: c.type,
        status: connected.has(c.provider) ? "connected" : "not_connected",
        sampleMappings: c.sampleMappings,
      }));
      return json({ data });
    }
    case "onboarding.company.apply": {
      if (!isCompanyAdmin(roles)) return json({ error: "Forbidden" }, 403);
      const { data: existingCo, error: loadErr } = await supabase.from("companies").select("settings").eq(
        "id",
        companyId,
      ).maybeSingle();
      if (loadErr) return json({ error: loadErr.message }, 400);
      const prevSettings =
        existingCo?.settings &&
          typeof existingCo.settings === "object" &&
          !Array.isArray(existingCo.settings)
          ? (existingCo.settings as Record<string, unknown>)
          : {};
      const onboardingProfile: Record<string, unknown> = {};
      if (body.addressLine1 !== undefined) onboardingProfile.addressLine1 = body.addressLine1;
      if (body.addressLine2 !== undefined) onboardingProfile.addressLine2 = body.addressLine2;
      if (body.city !== undefined) onboardingProfile.city = body.city;
      if (body.region !== undefined) onboardingProfile.region = body.region;
      if (body.postalCode !== undefined) onboardingProfile.postalCode = body.postalCode;
      if (body.website !== undefined) onboardingProfile.website = body.website;
      if (body.logoUrl !== undefined) onboardingProfile.logoUrl = body.logoUrl;
      if (body.taxId !== undefined) onboardingProfile.taxId = body.taxId;
      const mergedSettings = {
        ...prevSettings,
        onboarding_profile: onboardingProfile,
      };
      const patch = {
        legal_name: body.legalName,
        display_name: body.displayName,
        name: body.displayName,
        country: body.country ?? null,
        timezone: body.timezone,
        currency: body.currency,
        settings: mergedSettings,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: companyRow, error: upErr } = await supabase.from("companies").update(patch).eq(
        "id",
        companyId,
      ).select("*").single();
      if (upErr) return json({ error: upErr.message }, 400);

      const names = Array.from(
        new Set(
          body.departmentNames.map((n) => n.trim()).filter((n) => n.length > 0),
        ),
      );
      const { data: existingDepts } = await supabase.from("departments").select("name").eq(
        "company_id",
        companyId,
      );
      const existingNames = new Set(
        (Array.isArray(existingDepts) ? existingDepts : []).map((d) =>
          String((d as { name: string }).name).toLowerCase()
        ),
      );
      const departmentsToAdd = names.filter((n) => !existingNames.has(n.toLowerCase()));
      if (departmentsToAdd.length > 0) {
        const rows = departmentsToAdd.map((name) => ({
          company_id: companyId,
          name,
          settings: {} as Record<string, unknown>,
        }));
        const { error: depErr } = await supabase.from("departments").insert(rows);
        if (depErr) return json({ error: depErr.message }, 400);
      }

      const intKeys = Array.isArray(body.suggestedIntegrationKeys)
        ? body.suggestedIntegrationKeys
        : [];
      if (intKeys.length > 0) {
        const cfgNow = new Date().toISOString();
        const { data: cfgEx } = await supabase.from("tenant_configs").select("id").eq(
          "company_id",
          companyId,
        ).eq("config_key", "onboarding.suggested_integrations").maybeSingle();
        const cfgRow = {
          company_id: companyId,
          config_key: "onboarding.suggested_integrations",
          config_value: { providers: intKeys, templateId: body.templateId ?? null },
          updated_at: cfgNow,
        };
        if (cfgEx?.id) {
          await supabase.from("tenant_configs").update(cfgRow).eq("id", cfgEx.id);
        } else {
          await supabase.from("tenant_configs").insert({ ...cfgRow, created_at: cfgNow });
        }
      }

      await supabase.from("activity_logs").insert({
        company_id: companyId,
        event_type: "system_change",
        actor_user_id: userId,
        payload: {
          action: "onboarding.company.apply",
          departmentsAdded: departmentsToAdd.length,
        },
        metadata: { source: "tenants-api" },
      });

      return json({
        data: {
          company: companyRow,
          departmentsCreated: departmentsToAdd.length,
        },
      });
    }
    default:
      return json({ error: "Unknown op" }, 400);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const { company_id, roles } = await loadProfile(supabase, userId);

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const parsed = opSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 422);
    }

    const body = parsed.data;
    const superReadOps: ParsedOp["op"][] = [
      "tenants.admin.list",
      "tenants.admin.get",
      "tenants.admin.integrationMonitor",
      "onboarding.templates.adminList",
    ];
    const superMutateOps: ParsedOp["op"][] = [
      "tenants.admin.create",
      "tenants.admin.patch",
      "tenants.admin.deprovision",
      "tenants.admin.bulkDeprovision",
      "onboarding.templates.upsert",
      "onboarding.templates.delete",
    ];

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = serviceKey ? createClient(url, serviceKey) : null;

    if (superReadOps.includes(body.op) || superMutateOps.includes(body.op)) {
      const needsMutate = superMutateOps.includes(body.op);
      const allowed = needsMutate ? isSuperAdmin(roles) : canTenantsAdminRead(roles);
      if (!allowed) {
        return json({ error: "Forbidden" }, 403);
      }
      if (!admin) {
        return json({ error: "Server missing service role" }, 500);
      }
      return await handleSuperAdmin(admin, userId, roles, body);
    }

    if (body.op === "onboarding.templates.list") {
      return await handleOp(
        supabase,
        userId,
        company_id ?? "",
        roles,
        body,
      );
    }

    if (body.op === "onboarding.integrations.suggestions") {
      if (!company_id) {
        return json({ error: "Profile missing company" }, 400);
      }
      return await handleOp(supabase, userId, company_id, roles, body);
    }

    if (!company_id) {
      return json({ error: "Profile missing company" }, 400);
    }

    return await handleOp(supabase, userId, company_id, roles, body);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
