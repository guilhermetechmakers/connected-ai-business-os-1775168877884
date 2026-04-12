/**
 * Intent Agent — analyzes user messages and returns a normalized integration query plan.
 * Secrets: OPENAI_API_KEY. Called by ai-api (Bearer JWT) with permitted tool ids.
 *
 * Deploy with `[functions.intent-agent] verify_jwt = false` in supabase/config.toml (or Dashboard),
 * then validate the user JWT in code — ES256 tokens can fail Kong’s gateway JWT check (see config.toml).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  intentPlanRequestSchema,
  intentPlanResultSchema,
  type IntentPlanResult,
} from "../_shared/intent-plan.ts";
import { resolveOpenAiModel } from "../_shared/openai-models.ts";

type LogLevel = "info" | "warn" | "error";

function writeLog(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const message = JSON.stringify(entry);
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.log(message);
}

function fallbackPlan(reason: string): IntentPlanResult {
  return {
    intent: "general",
    confidence: 0,
    reasoningSummary: reason,
    fallbackBehavior: "use_llm_tools",
  };
}

const REQUIRED_PLAN_KEYS = ["intent", "confidence", "reasoningSummary", "fallbackBehavior"] as const;
type RequiredPlanKey = typeof REQUIRED_PLAN_KEYS[number];

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeIntentPlanCandidate(raw: unknown): {
  normalized: Record<string, unknown>;
  returnedKeys: string[];
  missingRequiredKeys: RequiredPlanKey[];
  usedDefaults: boolean;
} {
  const source = asObject(raw);
  const returnedKeys = Object.keys(source);
  const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(source, key);
  const missingRequiredKeys = REQUIRED_PLAN_KEYS.filter((key) => !hasKey(key));
  let usedDefaults = missingRequiredKeys.length > 0;

  const normalized: Record<string, unknown> = {
    intent: "general",
    confidence: 0.35,
    reasoningSummary: "Model returned partial plan",
    fallbackBehavior: "use_llm_tools",
  };

  if (typeof source.intent === "string") {
    normalized.intent = source.intent;
  }

  if (hasKey("confidence")) {
    const numeric = Number(source.confidence);
    if (Number.isFinite(numeric)) {
      const clamped = clamp01(numeric);
      normalized.confidence = clamped;
      if (clamped !== numeric) usedDefaults = true;
    } else {
      usedDefaults = true;
    }
  }

  if (typeof source.reasoningSummary === "string") {
    const trimmed = source.reasoningSummary.trim();
    if (trimmed.length > 0) {
      normalized.reasoningSummary = trimmed.slice(0, 800);
      if (trimmed.length > 800) usedDefaults = true;
    } else {
      usedDefaults = true;
    }
  }

  if (source.fallbackBehavior === "use_llm_tools" || source.fallbackBehavior === "none") {
    normalized.fallbackBehavior = source.fallbackBehavior;
  } else if (hasKey("fallbackBehavior")) {
    usedDefaults = true;
  }

  if (typeof source.toolId === "string" && source.toolId.trim()) {
    normalized.toolId = source.toolId.trim();
  }

  if (typeof source.queryArgs === "object" && source.queryArgs !== null && !Array.isArray(source.queryArgs)) {
    normalized.queryArgs = source.queryArgs;
  }

  if (
    source.timeWindowHint === "today" ||
    source.timeWindowHint === "tomorrow" ||
    source.timeWindowHint === "this_week" ||
    source.timeWindowHint === "explicit" ||
    source.timeWindowHint === "none"
  ) {
    normalized.timeWindowHint = source.timeWindowHint;
  }

  const explicitDate = asObject(source.explicitDate);
  if (
    Number.isInteger(explicitDate.year) &&
    Number.isInteger(explicitDate.month) &&
    Number.isInteger(explicitDate.day)
  ) {
    normalized.explicitDate = {
      year: Number(explicitDate.year),
      month: Number(explicitDate.month),
      day: Number(explicitDate.day),
    };
  }

  return {
    normalized,
    returnedKeys,
    missingRequiredKeys,
    usedDefaults,
  };
}

/** Kong may strip or reject Authorization; ai-api also forwards X-Forwarded-Authorization. */
function getBearerToken(req: Request): string | null {
  const raw =
    req.headers.get("Authorization") ??
    req.headers.get("X-Forwarded-Authorization") ??
    req.headers.get("x-forwarded-authorization");
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const baseLog = { correlationId, method: req.method, path: new URL(req.url).pathname };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    writeLog("warn", "intent_agent.missing_bearer", baseLog);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    writeLog("warn", "intent_agent.auth_failed", {
      ...baseLog,
      error: authError?.message ?? null,
      code: authError?.status ?? null,
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = intentPlanRequestSchema.safeParse(raw);
  if (!parsed.success) {
    writeLog("warn", "intent_agent.invalid_body", { ...baseLog, userId: user.id, issues: parsed.error.flatten() });
    return new Response(
      JSON.stringify({ error: "Invalid body", issues: parsed.error.flatten() }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body = parsed.data;
  const reqCorrelation = body.correlationId ?? correlationId;
  writeLog("info", "intent_agent.request", {
    ...baseLog,
    userId: user.id,
    correlationId: reqCorrelation,
    mode: body.mode,
    permittedCount: body.permittedToolIds.length,
    clientNowIso: body.clientNowIso ?? null,
    clientTimeZone: body.clientTimeZone ?? null,
    clientLocale: body.clientLocale ?? null,
  });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    writeLog("error", "intent_agent.missing_openai", baseLog);
    return new Response(
      JSON.stringify({
        ok: true,
        data: fallbackPlan("OPENAI_API_KEY not configured"),
        correlationId: reqCorrelation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const refNow = body.clientNowIso ?? body.referenceNowIso ?? new Date().toISOString();
  const providerTz = body.providerTimezones?.google_calendar ?? null;
  const clientTz = body.clientTimeZone ?? null;
  const clientLocale = body.clientLocale ?? null;

  const system = [
    "You are an intent router for a business assistant. Output a single JSON object only.",
    "You must ALWAYS include these required keys in every response JSON: intent, confidence, reasoningSummary, fallbackBehavior.",
    "confidence must be a number between 0 and 1.",
    "fallbackBehavior must be exactly one of: use_llm_tools, none.",
    "If uncertain, still include all required keys and set intent='general', confidence<=0.5, fallbackBehavior='use_llm_tools'.",
    "Pick at most one integration tool (toolId) from permittedToolIds when the user clearly needs live connector data.",
    "For Google Calendar event lists, use toolId \"google_calendar.list_events\" and intent \"integration_read\".",
    "For Google Calendar create-event requests, use toolId \"google_calendar.create_event\" and intent \"integration_write\".",
    "For calendar create-event requests, include queryArgs.summary, queryArgs.start, queryArgs.end (RFC3339), optional queryArgs.description, optional queryArgs.calendarId, optional queryArgs.attendees (array of email strings or {email}), optional queryArgs.sendCalendarInvites (boolean; default true when attendees are present — sends Google invitation emails). Never put invitee emails only in the description; use queryArgs.attendees.",
    "If the user specifies only a clock time (e.g. 6pm) with no calendar day (no today/tomorrow/weekday/date), set confidence below 0.65 or intent \"general\" with fallbackBehavior \"use_llm_tools\" so the assistant can ask which day — do not silently pick \"today\".",
    "Gmail: search/list -> \"gmail.search_messages\"; single message -> \"gmail.get_message\"; thread -> \"gmail.get_thread\"; send -> \"gmail.send_email\"; draft -> \"gmail.create_draft\".",
    "Slack: channel read -> \"slack.fetch_channel_messages\"; thread read -> \"slack.fetch_thread_replies\"; send -> \"slack.send_message\"; update/delete -> \"slack.update_message\" / \"slack.delete_message\".",
    "Google Drive: search -> \"google_drive.search_files\"; metadata -> \"google_drive.fetch_file_metadata\"; content -> \"google_drive.fetch_file_content\"; revisions -> \"google_drive.list_revisions\".",
    "HubSpot: search -> \"hubspot.search_records\"; record lookup -> \"hubspot.get_record\"; contact/deal writes -> \"hubspot.upsert_contact\" / \"hubspot.create_contact\" / \"hubspot.create_deal\" / \"hubspot.update_deal_stage\".",
    "QuickBooks: list -> \"quickbooks.list_invoices\" / \"quickbooks.list_customers\"; single invoice -> \"quickbooks.get_invoice\"; writes -> \"quickbooks.create_customer\" / \"quickbooks.create_invoice\" / \"quickbooks.send_invoice_reminder\" / \"quickbooks.update_invoice_safe_fields\".",
    "Use timeWindowHint \"today\" for \"today\" / \"this day\". Use \"explicit\" only when you also set explicitDate {year,month,day} for that local calendar day.",
    "For google_calendar.list_events: any specific calendar day (including named weekdays like \"next Monday\", \"this Friday\", \"on Tuesday\") MUST set explicitDate to the resolved {year,month,day} using clientNowIso + clientTimeZone (and clientLocale for disambiguation). Never set timeWindowHint to \"explicit\" without explicitDate.",
    "Relative date phrases must be resolved using clientNowIso + clientTimeZone when provided.",
    "For ambiguous slash dates (e.g. 04/10/2026), parse according to clientLocale convention when provided.",
    `Reference \"now\" for disambiguation: ${refNow}.`,
    clientTz
      ? `Client timezone (IANA): ${clientTz}. This is authoritative for relative dates.`
      : "Client timezone unavailable; fall back to provider/company timezone.",
    clientLocale
      ? `Client locale: ${clientLocale}. Use it for ambiguous slash-date parsing.`
      : "Client locale unavailable; use best-effort slash-date parsing.",
    providerTz
      ? `Primary Google Calendar timezone (IANA): ${providerTz}. Prefer this for interpreting \"today\" for calendar queries.`
      : "No Google Calendar timezone supplied; use companyTimezone for calendar day boundaries.",
    `Company timezone (IANA): ${body.companyTimezone}.`,
    "If unsure or question is general knowledge, set intent \"general\", confidence below 0.5, fallbackBehavior \"use_llm_tools\".",
    "Never invent toolIds — only values from permittedToolIds.",
    "queryArgs should only include keys accepted by that tool (e.g. maxResults, query, calendarId, objectType).",
    "For list_events, you may omit timeMin/timeMax; the server will fill them from timeWindowHint.",
    "Output contract example: {\"intent\":\"general\",\"confidence\":0.2,\"reasoningSummary\":\"uncertain intent\",\"fallbackBehavior\":\"use_llm_tools\"}",
  ].join("\n");

  const userPayload = {
    mode: body.mode,
    workspaceId: body.workspaceId,
    userMessage: body.userMessage,
    permittedToolIds: body.permittedToolIds,
    toolCatalogSummary: body.toolCatalogSummary,
    clientNowIso: body.clientNowIso ?? null,
    clientTimeZone: body.clientTimeZone ?? null,
    clientLocale: body.clientLocale ?? null,
  };

  let planJson: unknown;
  try {
    const model = resolveOpenAiModel(null, "fast");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      writeLog("error", "intent_agent.openai_failed", { ...baseLog, status: res.status, detail: detail.slice(0, 400) });
      return new Response(
        JSON.stringify({
          ok: true,
          data: fallbackPlan(`OpenAI error (${res.status})`),
          correlationId: reqCorrelation,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const oai = await res.json() as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = oai.choices?.[0]?.message?.content;
    if (!content) {
      planJson = {};
    } else {
      planJson = JSON.parse(content);
    }
  } catch (e) {
    writeLog("error", "intent_agent.parse_or_network", { ...baseLog, error: String(e) });
    return new Response(
      JSON.stringify({
        ok: true,
        data: fallbackPlan("Intent model request failed"),
        correlationId: reqCorrelation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const normalizedPlan = normalizeIntentPlanCandidate(planJson);
  if (normalizedPlan.usedDefaults) {
    writeLog("info", "intent_agent.plan_normalized", {
      ...baseLog,
      correlationId: reqCorrelation,
      returnedKeys: normalizedPlan.returnedKeys,
      missingRequiredKeys: normalizedPlan.missingRequiredKeys,
      hasToolId: typeof normalizedPlan.normalized.toolId === "string",
    });
  }

  const validated = intentPlanResultSchema.safeParse(normalizedPlan.normalized);
  if (!validated.success) {
    writeLog("warn", "intent_agent.plan_invalid", {
      ...baseLog,
      correlationId: reqCorrelation,
      issues: validated.error.flatten(),
      returnedKeys: normalizedPlan.returnedKeys,
      missingRequiredKeys: normalizedPlan.missingRequiredKeys,
      hasToolId: typeof normalizedPlan.normalized.toolId === "string",
    });
    return new Response(
      JSON.stringify({
        ok: true,
        data: fallbackPlan("Model output did not match intent schema"),
        correlationId: reqCorrelation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = validated.data;
  if (data.toolId && !body.permittedToolIds.includes(data.toolId)) {
    writeLog("warn", "intent_agent.tool_not_permitted", { ...baseLog, toolId: data.toolId });
    return new Response(
      JSON.stringify({
        ok: true,
        data: fallbackPlan(`Model selected disallowed toolId ${data.toolId}`),
        correlationId: reqCorrelation,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  writeLog("info", "intent_agent.plan_created", {
    ...baseLog,
    correlationId: reqCorrelation,
    intent: data.intent,
    confidence: data.confidence,
    toolId: data.toolId ?? null,
  });

  return new Response(
    JSON.stringify({ ok: true, data, correlationId: reqCorrelation }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
