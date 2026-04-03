/**
 * Transactional email templates — list defaults, tenant overrides, preview with placeholders.
 * Integrates with SendGrid only when SENDGRID_API_KEY is set (sendTest); never expose keys to client.
 * Client: supabase.functions.invoke('transactional-email-api', { body: { op, ... } }).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const BUILTIN = [
  {
    key: "verification",
    subject: "Verify your email — {{companyName}}",
    body:
      "Hi {{displayName}},\n\nConfirm ownership: {{verificationLink}}\n\n— {{companyName}}",
    placeholders: ["companyName", "displayName", "verificationLink"],
  },
  {
    key: "onboarding_welcome",
    subject: "Welcome to {{companyName}}",
    body:
      "Your workspace is ready.\n\nNext: connect integrations and review the executive dashboard.\n\n— Team",
    placeholders: ["companyName"],
  },
  {
    key: "report_digest",
    subject: "Scheduled report: {{reportName}}",
    body: "Summary for {{period}} is attached.\n\nOpen dashboard: {{dashboardUrl}}",
    placeholders: ["reportName", "period", "dashboardUrl"],
  },
  {
    key: "alert_notification",
    subject: "Alert: {{alertTitle}}",
    body: "{{message}}\n\nSeverity: {{severity}}",
    placeholders: ["alertTitle", "message", "severity"],
  },
] as const;

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("emailTemplates.list") }),
  z.object({
    op: z.literal("emailTemplates.upsert"),
    templateKey: z.string().min(1).max(120),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(50000),
    placeholders: z.array(z.string()).max(100).optional(),
  }),
  z.object({
    op: z.literal("emailTemplates.clone"),
    sourceKey: z.string().min(1).max(120),
    newKey: z.string().min(1).max(120),
  }),
  z.object({
    op: z.literal("emailTemplates.preview"),
    templateKey: z.string().min(1).max(120),
    sample: z.record(z.string()).optional(),
  }),
  z.object({
    op: z.literal("emailTemplates.sendTest"),
    templateKey: z.string().min(1).max(120),
    toEmail: z.string().email(),
    sample: z.record(z.string()).optional(),
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
  const roles = Array.isArray(data?.roles) ? (data!.roles as string[]) : [];
  return { company_id: data?.company_id ?? null, roles };
}

function normalizeRoles(roles: string[]): string[] {
  return roles.map((r) => String(r).toLowerCase());
}

function isCompanyAdmin(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.some((x) => ["owner", "company_admin", "admin", "super_admin"].includes(x));
}

function applyPlaceholders(
  text: string,
  sample: Record<string, string> | undefined,
): string {
  let out = text;
  const map = sample ?? {};
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireUser(req);
    const { company_id, roles } = await loadProfile(supabase, userId);
    if (!company_id) {
      return json({ error: "Profile missing company" }, 400);
    }

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

    const body = parsed.data as ParsedOp;

    if (!isCompanyAdmin(roles)) {
      return json({ error: "Forbidden" }, 403);
    }

    switch (body.op) {
      case "emailTemplates.list": {
        const { data, error } = await supabase
          .from("email_templates")
          .select("*")
          .eq("company_id", company_id)
          .order("template_key", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        const overrides = Array.isArray(data) ? data : [];
        return json({ data: { builtins: [...BUILTIN], overrides } });
      }
      case "emailTemplates.upsert": {
        const now = new Date().toISOString();
        const placeholders = Array.isArray(body.placeholders) ? body.placeholders : [];
        const row = {
          company_id,
          template_key: body.templateKey,
          subject: body.subject,
          body: body.body,
          placeholders,
          updated_at: now,
        };
        const { data: existing } = await supabase
          .from("email_templates")
          .select("id")
          .eq("company_id", company_id)
          .eq("template_key", body.templateKey)
          .maybeSingle();
        let result;
        if (existing?.id) {
          const { data, error } = await supabase
            .from("email_templates")
            .update(row)
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) return json({ error: error.message }, 400);
          result = data;
        } else {
          const { data, error } = await supabase
            .from("email_templates")
            .insert({ ...row, created_at: now })
            .select("*")
            .single();
          if (error) return json({ error: error.message }, 400);
          result = data;
        }
        return json({ data: result });
      }
      case "emailTemplates.clone": {
        const base = BUILTIN.find((b) => b.key === body.sourceKey);
        const { data: srcRow } = await supabase
          .from("email_templates")
          .select("*")
          .eq("company_id", company_id)
          .eq("template_key", body.sourceKey)
          .maybeSingle();
        const subject = srcRow?.subject ?? base?.subject;
        const tplBody = srcRow?.body ?? base?.body;
        const phRaw = srcRow?.placeholders;
        const ph = Array.isArray(phRaw)
          ? (phRaw as string[])
          : base
          ? [...base.placeholders]
          : [];
        if (!subject || !tplBody) {
          return json({ error: "Source template not found" }, 404);
        }
        const now = new Date().toISOString();
        const row = {
          company_id,
          template_key: body.newKey,
          subject,
          body: tplBody,
          placeholders: ph,
          updated_at: now,
        };
        const { data: existing } = await supabase
          .from("email_templates")
          .select("id")
          .eq("company_id", company_id)
          .eq("template_key", body.newKey)
          .maybeSingle();
        let data;
        let error;
        if (existing?.id) {
          const res = await supabase
            .from("email_templates")
            .update(row)
            .eq("id", existing.id)
            .select("*")
            .single();
          data = res.data;
          error = res.error;
        } else {
          const res = await supabase
            .from("email_templates")
            .insert({ ...row, created_at: now })
            .select("*")
            .single();
          data = res.data;
          error = res.error;
        }
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }
      case "emailTemplates.preview": {
        const sample = body.sample && typeof body.sample === "object" ? body.sample : {};
        const { data: row } = await supabase
          .from("email_templates")
          .select("*")
          .eq("company_id", company_id)
          .eq("template_key", body.templateKey)
          .maybeSingle();
        const base = BUILTIN.find((b) => b.key === body.templateKey);
        const subject = row?.subject ?? base?.subject ?? "";
        const tplBody = row?.body ?? base?.body ?? "";
        return json({
          data: {
            subject: applyPlaceholders(subject, sample),
            body: applyPlaceholders(tplBody, sample),
          },
        });
      }
      case "emailTemplates.sendTest": {
        const key = Deno.env.get("SENDGRID_API_KEY");
        if (!key) {
          return json({
            data: { ok: false, message: "SENDGRID_API_KEY not configured on project" },
          });
        }
        const sample = body.sample && typeof body.sample === "object" ? body.sample : {};
        const { data: row } = await supabase
          .from("email_templates")
          .select("*")
          .eq("company_id", company_id)
          .eq("template_key", body.templateKey)
          .maybeSingle();
        const base = BUILTIN.find((b) => b.key === body.templateKey);
        const subject = applyPlaceholders(row?.subject ?? base?.subject ?? "", sample);
        const tplBody = applyPlaceholders(row?.body ?? base?.body ?? "", sample);
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: body.toEmail }], subject }],
            from: { email: "noreply@connected-ai.local", name: "Connected AI OS" },
            content: [{ type: "text/plain", value: tplBody }],
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          return json({ data: { ok: false, message: t.slice(0, 500) } }, 200);
        }
        await supabase.from("activity_logs").insert({
          company_id,
          event_type: "system_change",
          actor_user_id: userId,
          payload: { action: "emailTemplates.sendTest", templateKey: body.templateKey },
          metadata: { source: "transactional-email-api" },
        });
        return json({ data: { ok: true } });
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
