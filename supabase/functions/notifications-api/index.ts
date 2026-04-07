/**
 * Notifications & alerts API — in-app store, bulk updates, rules, schedules, preferences,
 * Resend/FCM test dispatch (tenant secrets encrypted with CREDENTIALS_MASTER_KEY).
 * Client: supabase.functions.invoke('notifications-api', { body: { op, ... } }).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import {
  decryptCredentialsJson,
  encryptCredentialsJson,
} from "../_shared/credentials-crypto.ts";
import { sendResendEmail } from "../_shared/resend-mail.ts";

const notificationType = z.enum(["system", "in_app", "email", "push"]);
const channel = z.enum(["in_app", "email", "push"]);
const _notifStatus = z.enum(["pending", "delivered", "failed", "acknowledged", "dismissed"]);
const triggerType = z.enum(["kpi", "workflow", "ai"]);

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("notifications.list"),
    status: z.enum(["all", "unread", "read"]).optional(),
    channel: channel.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort: z.enum(["created_at_desc", "created_at_asc", "priority_desc"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  z.object({ op: z.literal("notifications.get"), id: z.string().uuid() }),
  z.object({
    op: z.literal("notifications.create"),
    title: z.string().min(1).max(500),
    message: z.string().min(1).max(8000),
    notification_type: notificationType.default("in_app"),
    channel: channel.default("in_app"),
    data: z.record(z.unknown()).optional(),
    related_item_id: z.string().uuid().optional(),
    alert_rule_id: z.string().uuid().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    target_user_id: z.string().uuid().optional(),
  }),
  z.object({
    op: z.literal("notifications.bulkUpdate"),
    ids: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum(["read", "unread", "dismiss", "acknowledge"]),
  }),
  z.object({ op: z.literal("alertRules.list") }),
  z.object({
    op: z.literal("alertRules.create"),
    name: z.string().min(1).max(200),
    trigger_type: triggerType,
    conditions: z.record(z.unknown()).default({}),
    actions: z.array(z.record(z.unknown())).default([]),
    enabled: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("alertRules.update"),
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    trigger_type: triggerType.optional(),
    conditions: z.record(z.unknown()).optional(),
    actions: z.array(z.record(z.unknown())).optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({ op: z.literal("alertRules.delete"), id: z.string().uuid() }),
  z.object({ op: z.literal("schedules.list") }),
  z.object({
    op: z.literal("schedules.create"),
    name: z.string().min(1).max(200),
    cron_expression: z.string().min(1).max(200),
    payload_template: z.record(z.unknown()).default({}),
    active: z.boolean().optional(),
    next_run_at: z.string().optional(),
  }),
  z.object({ op: z.literal("preferences.get") }),
  z.object({
    op: z.literal("preferences.upsert"),
    channels: z.array(z.string()).optional(),
    preferences: z.record(z.unknown()).optional(),
    quiet_hours: z
      .object({ start: z.string(), end: z.string() })
      .optional()
      .nullable(),
    data_retention_days: z.number().int().min(1).max(3650).optional(),
  }),
  z.object({ op: z.literal("channelSettings.get") }),
  z.object({
    op: z.literal("channelSettings.upsert"),
    resend_from_email: z.string().email().optional().nullable(),
    resend_reply_to: z.string().email().optional().nullable(),
    fcm_sender_id: z.string().max(200).optional().nullable(),
    webhook_delivery_url: z.string().url().optional().nullable(),
  }),
  z.object({
    op: z.literal("channelSecrets.upsert"),
    provider: z.enum(["resend", "fcm"]),
    resend_api_key: z.string().min(10).optional(),
    fcm_server_key: z.string().min(10).optional(),
  }),
  z.object({
    op: z.literal("channels.testResend"),
    to_email: z.string().email(),
  }),
  z.object({
    op: z.literal("channels.testFcm"),
    device_token: z.string().min(10),
  }),
  z.object({
    op: z.literal("rules.evaluateKpi"),
    kpi_id: z.string().uuid(),
    value: z.number(),
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

function canAdminChannels(roles: string[]): boolean {
  const r = roles.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["admin", "owner", "tenant admin", "tenant_admin", "manager", "integrations lead"]
      .includes(x)
  );
}

function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

async function loadDecryptedSecret(
  companyId: string,
  provider: "resend" | "fcm",
): Promise<Record<string, unknown>> {
  const master = Deno.env.get("CREDENTIALS_MASTER_KEY");
  if (!master) return {};
  const admin = serviceClient();
  const { data, error } = await admin
    .from("notification_provider_credentials")
    .select("encrypted_payload")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data?.encrypted_payload) return {};
  try {
    return await decryptCredentialsJson(data.encrypted_payload, master);
  } catch {
    return {};
  }
}

async function sendResend(
  args: { apiKey: string; from: string; to: string; subject: string; text: string },
) {
  await sendResendEmail({
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    apiKey: args.apiKey,
  });
}

async function sendFcm(args: {
  serverKey: string;
  token: string;
  title: string;
  body: string;
}) {
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${args.serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: args.token,
      notification: { title: args.title, body: args.body },
      priority: "high",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`FCM: ${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  }
}

async function handleOp(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  roles: string[],
  body: ParsedOp,
): Promise<Response> {
  const isAdmin = canAdminChannels(roles);

  switch (body.op) {
    case "notifications.list": {
      const limit = body.limit ?? 50;
      const offset = body.offset ?? 0;
      let q = supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .eq("user_id", userId);
      if (body.sort === "priority_desc") {
        q = q.order("priority", { ascending: false }).order("created_at", { ascending: false });
      } else {
        q = q.order("created_at", {
          ascending: body.sort === "created_at_asc",
        });
      }
      if (body.status === "unread") q = q.is("read_at", null);
      if (body.status === "read") q = q.not("read_at", "is", null);
      if (body.channel) q = q.eq("channel", body.channel);
      if (body.from) q = q.gte("created_at", body.from);
      if (body.to) q = q.lte("created_at", body.to);
      const { data, error, count } = await q.range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 400);
      const rows = Array.isArray(data) ? data : [];
      return json({
        data: { items: rows, count: count ?? rows.length },
      });
    }
    case "notifications.get": {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", body.id)
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "notifications.create": {
      const target = body.target_user_id ?? userId;
      if (body.target_user_id && body.target_user_id !== userId && !isAdmin) {
        return json({ error: "Forbidden" }, 403);
      }
      const row = {
        company_id: companyId,
        user_id: target,
        notification_type: body.notification_type,
        title: body.title,
        message: body.message,
        data: body.data ?? {},
        channel: body.channel,
        status: "delivered" as const,
        related_item_id: body.related_item_id ?? null,
        alert_rule_id: body.alert_rule_id ?? null,
        priority: body.priority ?? 0,
        read_at: null as string | null,
      };
      const { data, error } = await supabase
        .from("notifications")
        .insert(row)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "notifications.bulkUpdate": {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {};
      if (body.action === "read") patch.read_at = now;
      if (body.action === "unread") patch.read_at = null;
      if (body.action === "dismiss") {
        patch.status = "dismissed";
        patch.read_at = now;
      }
      if (body.action === "acknowledge") {
        patch.status = "acknowledged";
        patch.read_at = now;
      }
      const { data, error } = await supabase
        .from("notifications")
        .update(patch)
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .in("id", body.ids)
        .select("id");
      if (error) return json({ error: error.message }, 400);
      const updated = Array.isArray(data) ? data : [];
      return json({ data: { updated: updated.length } });
    }
    case "alertRules.list": {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "alertRules.create": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const { data, error } = await supabase
        .from("alert_rules")
        .insert({
          company_id: companyId,
          name: body.name,
          trigger_type: body.trigger_type,
          conditions: body.conditions,
          actions: body.actions,
          enabled: body.enabled ?? true,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "alertRules.update": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.trigger_type !== undefined) patch.trigger_type = body.trigger_type;
      if (body.conditions !== undefined) patch.conditions = body.conditions;
      if (body.actions !== undefined) patch.actions = body.actions;
      if (body.enabled !== undefined) patch.enabled = body.enabled;
      const { data, error } = await supabase
        .from("alert_rules")
        .update(patch)
        .eq("id", body.id)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "alertRules.delete": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const { error } = await supabase
        .from("alert_rules")
        .delete()
        .eq("id", body.id)
        .eq("company_id", companyId);
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ok: true } });
    }
    case "schedules.list": {
      const { data, error } = await supabase
        .from("notification_schedules")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data: Array.isArray(data) ? data : [] });
    }
    case "schedules.create": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const { data, error } = await supabase
        .from("notification_schedules")
        .insert({
          company_id: companyId,
          name: body.name,
          cron_expression: body.cron_expression,
          payload_template: body.payload_template,
          active: body.active ?? true,
          next_run_at: body.next_run_at ?? null,
        })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "preferences.get": {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data: data ?? null });
    }
    case "preferences.upsert": {
      const row = {
        company_id: companyId,
        user_id: userId,
        channels: body.channels ?? ["in_app"],
        preferences: body.preferences ?? {},
        quiet_hours: body.quiet_hours ?? null,
        data_retention_days: body.data_retention_days ?? 365,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert(row, { onConflict: "company_id,user_id" })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "channelSettings.get": {
      const { data, error } = await supabase
        .from("notification_channel_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ data: data ?? null });
    }
    case "channelSettings.upsert": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const row = {
        company_id: companyId,
        resend_from_email: body.resend_from_email ?? null,
        resend_reply_to: body.resend_reply_to ?? null,
        fcm_sender_id: body.fcm_sender_id ?? null,
        webhook_delivery_url: body.webhook_delivery_url ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("notification_channel_settings")
        .upsert(row, { onConflict: "company_id" })
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    case "channelSecrets.upsert": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const master = Deno.env.get("CREDENTIALS_MASTER_KEY");
      if (!master) {
        return json({ error: "CREDENTIALS_MASTER_KEY not configured" }, 500);
      }
      const secret: Record<string, unknown> = {};
      if (body.provider === "resend" && body.resend_api_key) {
        secret.api_key = body.resend_api_key;
      }
      if (body.provider === "fcm" && body.fcm_server_key) {
        secret.server_key = body.fcm_server_key;
      }
      if (Object.keys(secret).length === 0) {
        return json({ error: "No secret fields provided" }, 400);
      }
      const encrypted = await encryptCredentialsJson(secret, master);
      const admin = serviceClient();
      const { error } = await admin.from("notification_provider_credentials").upsert(
        {
          company_id: companyId,
          provider: body.provider,
          encrypted_payload: encrypted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,provider" },
      );
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ok: true, provider: body.provider } });
    }
    case "channels.testResend": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const secrets = await loadDecryptedSecret(companyId, "resend");
      const apiKey = typeof secrets.api_key === "string" ? secrets.api_key : "";
      if (!apiKey) {
        return json({ error: "Store a Resend API key first" }, 400);
      }
      const { data: settings } = await supabase
        .from("notification_channel_settings")
        .select("resend_from_email")
        .eq("company_id", companyId)
        .maybeSingle();
      const from = settings?.resend_from_email?.trim();
      if (!from) {
        return json({ error: "Set resend_from_email in channel settings" }, 400);
      }
      try {
        await sendResend({
          apiKey,
          from,
          to: body.to_email,
          subject: "Connected AI Business OS — test email",
          text: "This is a transactional test from your tenant notification channel.",
        });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Send failed" }, 502);
      }
      return json({ data: { ok: true } });
    }
    case "channels.testFcm": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const secrets = await loadDecryptedSecret(companyId, "fcm");
      const serverKey = typeof secrets.server_key === "string" ? secrets.server_key : "";
      if (!serverKey) {
        return json({ error: "Store an FCM server key first" }, 400);
      }
      try {
        await sendFcm({
          serverKey,
          token: body.device_token,
          title: "Test push",
          body: "Connected AI Business OS — FCM test",
        });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Push failed" }, 502);
      }
      return json({ data: { ok: true } });
    }
    case "rules.evaluateKpi": {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const admin = serviceClient();
      const { data: rules, error: rErr } = await admin
        .from("alert_rules")
        .select("*")
        .eq("company_id", companyId)
        .eq("enabled", true)
        .eq("trigger_type", "kpi");
      if (rErr) return json({ error: rErr.message }, 400);
      const list = Array.isArray(rules) ? rules : [];
      let fired = 0;
      for (const rule of list) {
        const cond = (rule.conditions as Record<string, unknown>) ?? {};
        const kid = typeof cond.kpi_id === "string" ? cond.kpi_id : "";
        const threshold = typeof cond.threshold === "number" ? cond.threshold : null;
        const op = typeof cond.op === "string" ? cond.op : "gte";
        if (!kid || kid !== body.kpi_id || threshold === null) continue;
        const ok =
          op === "lte"
            ? body.value <= threshold
            : op === "eq"
            ? body.value === threshold
            : body.value >= threshold;
        if (!ok) continue;
        const actions = Array.isArray(rule.actions) ? rule.actions : [];
        const { data: profiles } = await admin
          .from("profiles")
          .select("id")
          .eq("company_id", companyId);
        const targets = Array.isArray(profiles) ? profiles : [];
        const channelsFromRule = actions.flatMap((a: unknown) => {
          if (!a || typeof a !== "object") return [];
          const ch = (a as Record<string, unknown>).channels;
          return Array.isArray(ch) ? ch.map((x) => String(x)) : ["in_app"];
        });
        const useChannels = channelsFromRule.length ? channelsFromRule : ["in_app"];
        for (const p of targets) {
          if (!p?.id) continue;
          const title =
            typeof (actions[0] as Record<string, unknown>)?.title === "string"
              ? String((actions[0] as Record<string, unknown>).title)
              : `KPI alert: ${rule.name}`;
          const message =
            typeof (actions[0] as Record<string, unknown>)?.message === "string"
              ? String((actions[0] as Record<string, unknown>).message)
              : `Rule "${rule.name}" triggered (value ${body.value}).`;
          if (useChannels.includes("in_app")) {
            const { error: insErr } = await admin.from("notifications").insert({
              company_id: companyId,
              user_id: p.id,
              notification_type: "in_app",
              title,
              message,
              data: { kpi_id: body.kpi_id, value: body.value, rule_id: rule.id },
              channel: "in_app",
              status: "delivered",
              alert_rule_id: rule.id,
            });
            if (!insErr) fired += 1;
          }
        }
      }
      return json({ data: { fired } });
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
    assertCompany(company_id);

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

    return await handleOp(supabase, userId, company_id, roles, parsed.data);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return json({ error: msg }, 500);
  }
});
