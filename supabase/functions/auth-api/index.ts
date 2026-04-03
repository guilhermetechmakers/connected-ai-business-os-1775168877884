/**
 * Auth API — multi-tenant signup/login, refresh, password reset, email verification, profile, API keys,
 * tenant settings (admin), team listing, SSO unlink, TOTP enroll/verify/disable, domain suggestions.
 * Uses Supabase Auth (GoTrue) for credentials; service role for provisioning and token-backed flows.
 * Client: POST /functions/v1/auth-api (native fetch or supabase.functions.invoke) with JSON body { op, ... }.
 * Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
 * Optional: SITE_URL (for email links), GOOGLE_OAUTH_CLIENT_ID, MICROSOFT_OAUTH_CLIENT_ID.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { generateBase32Secret, verifyTotp } from "../_shared/totp.ts";

const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 30 * 60 * 1000;

const passwordPolicySchema = z.object({
  minLength: z.number().min(6).max(128),
  requireSpecialChar: z.boolean(),
  requireNumbers: z.boolean(),
  requireUppercase: z.boolean(),
});

type PasswordPolicy = z.infer<typeof passwordPolicySchema>;

const defaultPolicy: PasswordPolicy = {
  minLength: 10,
  requireSpecialChar: true,
  requireNumbers: true,
  requireUppercase: true,
};

const companyProfileSignupSchema = z
  .object({
    timeZone: z.string().min(1).max(80).optional(),
    currency: z.string().min(1).max(16).optional(),
    departments: z.array(z.string().min(1).max(120)).max(50).optional(),
    integrations: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  .strict();

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("auth.signup"),
    tenantName: z.string().min(2).max(200),
    industry: z.string().max(120).optional(),
    domainHint: z.string().max(200).optional(),
    fullName: z.string().min(2).max(200),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    inviteToken: z.string().max(500).optional(),
    acceptTerms: z.boolean(),
    companyProfile: companyProfileSignupSchema.optional(),
  }),
  z.object({
    op: z.literal("domains.suggestions"),
    base: z.string().min(1).max(200),
  }),
  z.object({
    op: z.literal("auth.login"),
    email: z.string().email(),
    password: z.string().min(1).max(200),
    tenantDomain: z.string().max(200).optional(),
    tenantId: z.string().uuid().optional(),
    rememberMe: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("auth.sso.start"),
    tenantId: z.string().uuid().optional(),
    redirectTo: z.string().url().optional(),
  }),
  z.object({
    op: z.literal("auth.logout"),
    refreshToken: z.string().optional(),
  }),
  z.object({
    op: z.literal("auth.refresh"),
    refreshToken: z.string().min(10),
  }),
  z.object({ op: z.literal("auth.status") }),
  z.object({
    op: z.literal("password.request"),
    email: z.string().email(),
  }),
  z.object({
    op: z.literal("password.confirm"),
    token: z.string().min(8),
    password: z.string().min(8).max(200),
  }),
  z.object({
    op: z.literal("verify.email"),
    token: z.string().min(8),
  }),
  z.object({
    op: z.literal("invitations.resolve"),
    token: z.string().min(4).max(500),
  }),
  z.object({
    op: z.literal("profile.get"),
  }),
  z.object({ op: z.literal("profile.ensure") }),
  z.object({
    op: z.literal("profile.update"),
    displayName: z.string().min(2).max(200).optional(),
    avatarUrl: z.union([z.string().url(), z.literal("")]).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    jobTitle: z.string().max(200).optional(),
    department: z.string().max(200).optional(),
    contactInfo: z.record(z.string(), z.unknown()).optional(),
    bio: z.string().max(8000).optional(),
  }),
  z.object({
    op: z.literal("apikeys.create"),
    name: z.string().min(2).max(120),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.string().optional(),
  }),
  z.object({
    op: z.literal("apikeys.list"),
  }),
  z.object({
    op: z.literal("apikeys.revoke"),
    keyId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("apikeys.patch"),
    keyId: z.string().uuid(),
    name: z.string().min(2).max(120).optional(),
    scopes: z.array(z.string()).optional(),
  }),
  z.object({
    op: z.literal("apikeys.rotate"),
    keyId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("connections.disconnect"),
    connectionId: z.string().uuid(),
  }),
  z.object({
    op: z.literal("oauth.url"),
    provider: z.enum(["google", "microsoft"]),
    redirectTo: z.string().url().optional(),
  }),
  z.object({ op: z.literal("mfa.status") }),
  z.object({ op: z.literal("mfa.verify"), code: z.string().min(4).optional() }),
  z.object({ op: z.literal("tenant.settings.get") }),
  z.object({
    op: z.literal("tenant.settings.patch"),
    name: z.string().min(2).max(200).optional(),
    timezone: z.string().min(1).max(80).optional(),
    currency: z.string().min(1).max(16).optional(),
    industry: z.string().max(120).nullable().optional(),
    address: z.string().max(2000).nullable().optional(),
    contact_email: z.string().max(320).nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    sso_settings: z.record(z.string(), z.unknown()).optional(),
    password_policy: z.record(z.string(), z.unknown()).optional(),
    allowed_auth_methods: z.array(z.string()).optional(),
  }),
  z.object({ op: z.literal("tenant.users.list") }),
  z.object({
    op: z.literal("sso.unlink"),
    provider: z.enum(["google", "microsoft", "saml", "oidc"]),
  }),
  z.object({ op: z.literal("totp.enroll.start") }),
  z.object({
    op: z.literal("totp.enroll.verify"),
    code: z.string().min(6).max(10),
  }),
  z.object({
    op: z.literal("totp.disable"),
    code: z.string().min(6).max(10),
  }),
  z.object({ op: z.literal("saml.acs") }),
]);

type ParsedOp = z.infer<typeof opSchema>;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomToken(): string {
  const u = crypto.randomUUID().replace(/-/g, "");
  return `${u}${crypto.randomUUID().replace(/-/g, "")}`;
}

function validatePassword(pw: string, policy: PasswordPolicy): string | null {
  if (pw.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }
  if (policy.requireNumbers && !/\d/.test(pw)) {
    return "Password must include a number";
  }
  if (policy.requireUppercase && !/[A-Z]/.test(pw)) {
    return "Password must include an uppercase letter";
  }
  if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(pw)) {
    return "Password must include a special character";
  }
  return null;
}

function slugifyDomainBase(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length > 0 ? s : "workspace";
}

function buildDomainSuggestions(base: string): string[] {
  const slug = slugifyDomainBase(base);
  const variants = [
    `${slug}.connected.ai`,
    `${slug}-hq.connected.ai`,
    `${slug}-app.connected.ai`,
    `${slug}-os.connected.ai`,
  ];
  return [...new Set(variants)];
}

async function isCompanyDomainTaken(
  admin: SupabaseClient,
  domain: string,
): Promise<boolean> {
  const d = domain.trim().toLowerCase();
  if (!d) return false;
  const { data } = await admin.from("companies").select("id").ilike("domain", d).maybeSingle();
  return Boolean(data);
}

type CompanyProfileSignup = z.infer<typeof companyProfileSignupSchema>;

async function applySignupCompanyProfile(
  admin: SupabaseClient,
  companyId: string,
  profile: CompanyProfileSignup,
): Promise<void> {
  const hasDept = Array.isArray(profile.departments);
  const hasInt = Array.isArray(profile.integrations);
  const hasTz = typeof profile.timeZone === "string" && profile.timeZone.trim().length > 0;
  const hasCur = typeof profile.currency === "string" && profile.currency.trim().length > 0;
  if (!hasDept && !hasInt && !hasTz && !hasCur) return;

  const departments = hasDept
    ? (profile.departments ?? [])
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0)
        .slice(0, 50)
    : [];
  const integrations = hasInt
    ? (profile.integrations ?? [])
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0)
        .slice(0, 32)
    : [];

  const { data: co, error: coErr } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  if (coErr || !co) return;

  const prevSettings =
    co.settings && typeof co.settings === "object" && !Array.isArray(co.settings)
      ? (co.settings as Record<string, unknown>)
      : {};
  const nextSettings: Record<string, unknown> = { ...prevSettings };
  if (departments.length > 0) nextSettings.onboarding_departments = departments;
  if (integrations.length > 0) nextSettings.suggested_integrations = integrations;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    settings: nextSettings,
  };
  if (hasTz) patch.timezone = profile.timeZone!.trim();
  if (hasCur) patch.currency = profile.currency!.trim();

  const { error: uErr } = await admin.from("companies").update(patch).eq("id", companyId);
  if (uErr) return;

  if (departments.length === 0) return;

  const { data: existingDepts } = await admin
    .from("departments")
    .select("name")
    .eq("company_id", companyId);
  const existing = new Set(
    (Array.isArray(existingDepts) ? existingDepts : [])
      .map((row) => String((row as { name?: string }).name ?? "").trim().toLowerCase())
      .filter((x) => x.length > 0),
  );

  for (const name of departments) {
    const key = name.toLowerCase();
    if (existing.has(key)) continue;
    const { error: dErr } = await admin.from("departments").insert({
      company_id: companyId,
      name: name.slice(0, 200),
    });
    if (!dErr) existing.add(key);
  }
}

function parsePolicy(raw: unknown): PasswordPolicy {
  const p = passwordPolicySchema.safeParse(raw);
  return p.success ? p.data : defaultPolicy;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "0.0.0.0"
  );
}

async function requireUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ userId: string; jwt: string; admin: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ data: null, error: { message: "Unauthorized" }, meta: {} }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jwt = authHeader.slice(7);
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ data: null, error: { message: "Invalid session" }, meta: {} }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.user.id, jwt, admin };
}

async function isLockedOut(
  admin: SupabaseClient,
  emailNorm: string,
): Promise<boolean> {
  const { data } = await admin
    .from("auth_lockouts")
    .select("locked_until")
    .eq("email_normalized", emailNorm)
    .maybeSingle();
  const until = data?.locked_until ? new Date(data.locked_until as string) : null;
  return until !== null && until > new Date();
}

async function recordFailure(admin: SupabaseClient, emailNorm: string, ip: string): Promise<void> {
  await admin.from("auth_login_attempts").insert({
    email_normalized: emailNorm,
    ip,
    success: false,
  });
  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("auth_login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("email_normalized", emailNorm)
    .eq("success", false)
    .gte("attempted_at", since);
  const failures = count ?? 0;
  if (failures >= MAX_FAILURES) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
    await admin.from("auth_lockouts").upsert({
      email_normalized: emailNorm,
      failed_count: failures,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });
  }
}

async function recordSuccess(admin: SupabaseClient, emailNorm: string, ip: string): Promise<void> {
  await admin.from("auth_login_attempts").insert({
    email_normalized: emailNorm,
    ip,
    success: true,
  });
  await admin.from("auth_lockouts").upsert({
    email_normalized: emailNorm,
    failed_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
}

async function logSecurityEvent(
  admin: SupabaseClient,
  companyId: string | null,
  profileId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await admin.from("auth_security_events").insert({
    company_id: companyId,
    profile_id: profileId,
    event_type: eventType,
    payload,
  });
}

function hasTenantAdminRole(roles: string[]): boolean {
  const list = Array.isArray(roles) ? roles : [];
  for (const r of list) {
    const n = r.toLowerCase().replace(/\s+/g, "_");
    if (
      n === "admin" ||
      n === "owner" ||
      n === "tenant_admin" ||
      n === "super_admin" ||
      r === "Tenant Admin"
    ) {
      return true;
    }
  }
  return false;
}

async function fetchProfileBundle(admin: SupabaseClient, userId: string) {
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select(
      "id,email,display_name,avatar_url,job_title,department,contact_info,totp_enabled,roles,auth_methods,company_id,preferences,status,created_at,bio",
    )
    .eq("id", userId)
    .maybeSingle();
  if (pErr || !profile) return { profile: null, company: null };
  const companyId = profile.company_id as string | null;
  let company: Record<string, unknown> | null = null;
  if (companyId) {
    const { data: co } = await admin
      .from("companies")
      .select(
        "id,name,domain,industry,timezone,currency,address,contact_email,sso_settings,password_policy,allowed_auth_methods,settings,created_at",
      )
      .eq("id", companyId)
      .maybeSingle();
    company = co;
  }
  return { profile, company };
}

async function notifyEmail(
  kind: "verification" | "password_reset",
  to: string,
  token: string,
): Promise<void> {
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-auth-notifications`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return;
  try {
    await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ kind, to, token }),
    });
  } catch {
    /* non-fatal */
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse(
      { data: null, error: { message: "Server misconfigured" }, meta: {} },
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let parsed: ParsedOp;
  try {
    const body = await req.json();
    const r = opSchema.safeParse(body);
    if (!r.success) {
      return jsonResponse(
        { data: null, error: { message: "Invalid request", details: r.error.flatten() }, meta: {} },
        400,
      );
    }
    parsed = r.data;
  } catch {
    return jsonResponse({ data: null, error: { message: "Invalid JSON" }, meta: {} }, 400);
  }

  try {
    switch (parsed.op) {
      case "auth.status":
        return jsonResponse({
          data: { ok: true, version: "1" },
          error: null,
          meta: {},
        });

      case "mfa.status": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const totpOn = Boolean(
          bundle.profile && (bundle.profile as Record<string, unknown>).totp_enabled === true,
        );
        return jsonResponse({
          data: {
            enabled: totpOn,
            factors: totpOn ? (["totp"] as string[]) : ([] as string[]),
          },
          error: null,
          meta: {},
        });
      }

      case "mfa.verify":
        return jsonResponse(
          { data: null, error: { message: "MFA not enabled for this tenant" }, meta: {} },
          501,
        );

      case "saml.acs":
        return jsonResponse(
          { data: null, error: { message: "SAML ACS must be configured on the IdP integration" }, meta: {} },
          501,
        );

      case "oauth.url": {
        const site = parsed.redirectTo ?? Deno.env.get("SITE_URL") ?? "http://localhost:5173";
        if (parsed.provider === "google") {
          const cid = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
          if (!cid) {
            return jsonResponse({
              data: null,
              error: { message: "Google OAuth is not configured" },
              meta: {},
            }, 503);
          }
          const q = new URLSearchParams({
            client_id: cid,
            redirect_uri: `${supabaseUrl}/auth/v1/callback`,
            response_type: "code",
            scope: "openid email profile",
            state: site,
          });
          return jsonResponse({
            data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}` },
            error: null,
            meta: {},
          });
        }
        const msid = Deno.env.get("MICROSOFT_OAUTH_CLIENT_ID") ?? "";
        if (!msid) {
          return jsonResponse({
            data: null,
            error: { message: "Microsoft OAuth is not configured" },
            meta: {},
          }, 503);
        }
        const q2 = new URLSearchParams({
          client_id: msid,
          response_type: "code",
          redirect_uri: `${supabaseUrl}/auth/v1/callback`,
          scope: "openid email profile offline_access",
          state: site,
        });
        return jsonResponse({
          data: {
            url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q2.toString()}`,
          },
          error: null,
          meta: {},
        });
      }

      case "domains.suggestions": {
        const suggestions = buildDomainSuggestions(parsed.base);
        return jsonResponse({
          data: { suggestions },
          error: null,
          meta: {},
        });
      }

      case "invitations.resolve": {
        const { data: inv } = await admin
          .from("invitations")
          .select("email,company_id,status,expires_at")
          .eq("token", parsed.token)
          .maybeSingle();
        if (!inv || inv.status !== "pending") {
          return jsonResponse({
            data: null,
            error: { message: "Invalid or expired invitation" },
            meta: {},
          }, 400);
        }
        if (new Date(inv.expires_at as string) < new Date()) {
          return jsonResponse({
            data: null,
            error: { message: "Invitation expired" },
            meta: {},
          }, 400);
        }
        let companyName: string | null = null;
        if (inv.company_id) {
          const { data: co } = await admin
            .from("companies")
            .select("name")
            .eq("id", inv.company_id as string)
            .maybeSingle();
          companyName = (co?.name as string) ?? null;
        }
        return jsonResponse({
          data: {
            email: inv.email,
            companyId: inv.company_id,
            companyName,
          },
          error: null,
          meta: {},
        });
      }

      case "auth.signup": {
        if (!parsed.acceptTerms) {
          return jsonResponse({
            data: null,
            error: { message: "Terms must be accepted" },
            meta: {},
          }, 400);
        }
        const emailNorm = normalizeEmail(parsed.email);
        const ip = getClientIp(req);
        let companyId: string;
        let defaultRoles: string[] = ["admin"];

        if (parsed.inviteToken) {
          const { data: inv } = await admin
            .from("invitations")
            .select("id,company_id,email,status,expires_at")
            .eq("token", parsed.inviteToken)
            .maybeSingle();
          if (!inv || inv.status !== "pending" || new Date(inv.expires_at as string) < new Date()) {
            return jsonResponse({
              data: null,
              error: { message: "Invalid or expired invitation" },
              meta: {},
            }, 400);
          }
          if (normalizeEmail(inv.email as string) !== emailNorm) {
            return jsonResponse({
              data: null,
              error: { message: "Email must match the invitation" },
              meta: {},
            }, 400);
          }
          companyId = inv.company_id as string;
          defaultRoles = ["member"];
        } else {
          const hint = parsed.domainHint?.trim() ?? "";
          if (hint.length > 0 && (await isCompanyDomainTaken(admin, hint))) {
            return jsonResponse({
              data: null,
              error: { message: "Suggested domain is already in use" },
              meta: { code: "domain_taken" },
            }, 400);
          }
          const cp = parsed.companyProfile;
          const tz =
            typeof cp?.timeZone === "string" && cp.timeZone.trim().length > 0
              ? cp.timeZone.trim()
              : "UTC";
          const cur =
            typeof cp?.currency === "string" && cp.currency.trim().length > 0
              ? cp.currency.trim()
              : "USD";
          const deptList = Array.isArray(cp?.departments)
            ? cp!.departments!.map((d) => String(d).trim()).filter((x) => x.length > 0).slice(0, 50)
            : [];
          const intList = Array.isArray(cp?.integrations)
            ? cp!.integrations!.map((d) => String(d).trim()).filter((x) => x.length > 0).slice(0, 32)
            : [];
          const settings = {
            industry: parsed.industry ?? null,
            domain_hint: parsed.domainHint ?? null,
            onboarding_departments: deptList,
            suggested_integrations: intList,
          };
          const { data: co, error: cErr } = await admin
            .from("companies")
            .insert({
              name: parsed.tenantName,
              domain: hint.length > 0 ? hint : null,
              industry: parsed.industry?.trim() || null,
              timezone: tz,
              currency: cur,
              settings,
            })
            .select("id")
            .single();
          if (cErr || !co) {
            return jsonResponse({
              data: null,
              error: { message: cErr?.message ?? "Could not create tenant" },
              meta: {},
            }, 400);
          }
          companyId = co.id as string;
        }

        const policy = defaultPolicy;
        const pwErr = validatePassword(parsed.password, policy);
        if (pwErr) {
          return jsonResponse({ data: null, error: { message: pwErr }, meta: {} }, 400);
        }

        const { data: created, error: signErr } = await admin.auth.admin.createUser({
          email: parsed.email,
          password: parsed.password,
          email_confirm: false,
          user_metadata: { full_name: parsed.fullName },
        });
        if (signErr || !created.user) {
          return jsonResponse({
            data: null,
            error: { message: signErr?.message ?? "Could not create user" },
            meta: {},
          }, 400);
        }

        const userId = created.user.id;
        const { error: profErr } = await admin.from("profiles").upsert({
          id: userId,
          email: parsed.email,
          display_name: parsed.fullName,
          company_id: companyId,
          roles: defaultRoles,
          auth_methods: ["password"],
        });
        if (profErr) {
          await admin.auth.admin.deleteUser(userId);
          return jsonResponse({
            data: null,
            error: { message: profErr.message },
            meta: {},
          }, 400);
        }

        if (parsed.inviteToken) {
          await admin
            .from("invitations")
            .update({ status: "accepted" })
            .eq("token", parsed.inviteToken);
        }

        if (parsed.companyProfile) {
          await applySignupCompanyProfile(admin, companyId, parsed.companyProfile);
        }

        const vToken = randomToken();
        const vExp = new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString();
        await admin.from("email_verification_tokens").insert({
          token: vToken,
          user_id: userId,
          expires_at: vExp,
        });
        await notifyEmail("verification", parsed.email, vToken);
        await logSecurityEvent(admin, companyId, userId, "signup_completed", { ip });

        return jsonResponse({
          data: {
            userId,
            companyId,
            emailVerificationSent: true,
          },
          error: null,
          meta: {},
        });
      }

      case "auth.sso.start": {
        const site = parsed.redirectTo ?? Deno.env.get("SITE_URL") ?? "http://localhost:5173";
        let idpUrl: string | null = null;
        if (parsed.tenantId) {
          const { data: co } = await admin
            .from("companies")
            .select("sso_settings,name")
            .eq("id", parsed.tenantId)
            .maybeSingle();
          if (!co) {
            return jsonResponse(
              {
                data: null,
                error: { message: "Workspace not found. Check your sign-in link." },
                meta: { code: "tenant_not_found" },
              },
              404,
            );
          }
          const sso =
            co?.sso_settings && typeof co.sso_settings === "object" && !Array.isArray(co.sso_settings)
              ? (co.sso_settings as Record<string, unknown>)
              : {};
          const candidates = [
            "saml_sso_url",
            "oidc_authorization_url",
            "idpAuthorizationUrl",
            "ssoEntryUrl",
            "entryUrl",
            "authorizationUrl",
          ] as const;
          for (const k of candidates) {
            const v = sso[k];
            if (typeof v === "string" && v.startsWith("http")) {
              idpUrl = v;
              break;
            }
          }
        }
        if (!idpUrl) {
          return jsonResponse(
            {
              data: null,
              error: {
                message:
                  "Enterprise SSO is not configured for this workspace. Use email sign-in or ask your admin to connect your IdP.",
              },
              meta: { code: "sso_not_configured" },
            },
            400,
          );
        }
        const sep = idpUrl.includes("?") ? "&" : "?";
        const url = `${idpUrl}${sep}return_to=${encodeURIComponent(`${site}/login`)}`;
        return jsonResponse({ data: { url }, error: null, meta: {} });
      }

      case "auth.login": {
        void parsed.rememberMe;
        const emailNorm = normalizeEmail(parsed.email);
        const ip = getClientIp(req);
        if (await isLockedOut(admin, emailNorm)) {
          return jsonResponse({
            data: null,
            error: { message: "Too many attempts. Try again later." },
            meta: { code: "lockout" },
          });
        }

        const anon = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: sessionData, error: signErr } = await anon.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (signErr || !sessionData.session) {
          await recordFailure(admin, emailNorm, ip);
          return jsonResponse({
            data: null,
            error: { message: "Invalid credentials" },
            meta: { code: "invalid_credentials" },
          });
        }

        const userId = sessionData.user.id;
        const { data: profile } = await admin
          .from("profiles")
          .select("company_id,email")
          .eq("id", userId)
          .maybeSingle();
        const companyId = profile?.company_id as string | null;

        if (parsed.tenantId && companyId && companyId !== parsed.tenantId) {
          await anon.auth.signOut();
          await recordFailure(admin, emailNorm, ip);
          return jsonResponse({
            data: null,
            error: { message: "Tenant mismatch" },
            meta: { code: "tenant_mismatch" },
          });
        }

        const emailDomain = parsed.email.split("@")[1]?.toLowerCase() ?? "";
        if (companyId) {
          const { data: co } = await admin
            .from("companies")
            .select("domain,sso_settings")
            .eq("id", companyId)
            .maybeSingle();
          const sso = (co?.sso_settings as Record<string, unknown> | null) ?? {};
          const allowPassword =
            typeof sso.allowPasswordLogin === "boolean" ? sso.allowPasswordLogin : true;
          if (!allowPassword) {
            await anon.auth.signOut();
            await recordFailure(admin, emailNorm, ip);
            return jsonResponse({
              data: null,
              error: { message: "Password sign-in is disabled for this tenant. Use SSO." },
              meta: { code: "sso_only" },
            });
          }
          const restrictionsRaw = sso.domainRestrictions;
          const restrictions = Array.isArray(restrictionsRaw)
            ? restrictionsRaw.map((d) => String(d).toLowerCase())
            : [];
          if (restrictions.length > 0 && !restrictions.includes(emailDomain)) {
            await anon.auth.signOut();
            await recordFailure(admin, emailNorm, ip);
            return jsonResponse({
              data: null,
              error: { message: "Email domain not allowed for this tenant" },
              meta: { code: "domain_restriction" },
            });
          }
          const tenantHint = parsed.tenantDomain?.trim().toLowerCase() ?? "";
          const registeredDomain = (co?.domain as string | null)?.toLowerCase() ?? "";
          if (tenantHint && registeredDomain && tenantHint !== registeredDomain) {
            await anon.auth.signOut();
            await recordFailure(admin, emailNorm, ip);
            return jsonResponse({
              data: null,
              error: { message: "Workspace domain does not match this account" },
              meta: { code: "tenant_domain_mismatch" },
            });
          }
        }

        const { data: userRow } = await admin.auth.admin.getUserById(userId);
        const emailConfirmed = Boolean(userRow.user?.email_confirmed_at);
        if (!emailConfirmed) {
          await anon.auth.signOut();
          await recordFailure(admin, emailNorm, ip);
          return jsonResponse({
            data: null,
            error: { message: "Email not verified" },
            meta: { code: "email_unverified" },
          });
        }

        await recordSuccess(admin, emailNorm, ip);
        const bundle = await fetchProfileBundle(admin, userId);
        await logSecurityEvent(admin, companyId, userId, "login_success", {
          ip,
          remember_me: parsed.rememberMe === true,
        });

        return jsonResponse({
          data: {
            session: {
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token,
              expires_at: sessionData.session.expires_at,
              expires_in: sessionData.session.expires_in,
              token_type: sessionData.session.token_type,
            },
            user: {
              id: userId,
              email: sessionData.user.email,
            },
            profile: bundle.profile,
            tenant: bundle.company,
          },
          error: null,
          meta: {},
        });
      }

      case "auth.logout": {
        const authHeader = req.headers.get("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
          const jwt = authHeader.slice(7);
          const { error: signOutErr } = await admin.auth.admin.signOut(jwt, "global");
          if (signOutErr) {
            return jsonResponse(
              {
                data: null,
                error: { message: signOutErr.message },
                meta: {},
              },
              400,
            );
          }
        }
        return jsonResponse({
          data: { ok: true },
          error: null,
          meta: {},
        });
      }

      case "auth.refresh": {
        const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ refresh_token: parsed.refreshToken }),
        });
        const j = await res.json();
        if (!res.ok) {
          return jsonResponse({
            data: null,
            error: { message: j.error_description ?? j.msg ?? "Refresh failed" },
            meta: {},
          }, 401);
        }
        return jsonResponse({
          data: {
            session: {
              access_token: j.access_token,
              refresh_token: j.refresh_token,
              expires_at: j.expires_at,
              expires_in: j.expires_in,
              token_type: j.token_type,
            },
          },
          error: null,
          meta: {},
        });
      }

      case "password.request": {
        const emailNorm = normalizeEmail(parsed.email);
        const { data: profile } = await admin
          .from("profiles")
          .select("id,company_id")
          .eq("email", emailNorm)
          .maybeSingle();
        if (!profile) {
          return jsonResponse({
            data: { ok: true },
            error: null,
            meta: { notice: "If the account exists, a reset link was sent." },
          });
        }
        const token = randomToken();
        const exp = new Date(Date.now() + 1000 * 60 * 60).toISOString();
        await admin.from("password_reset_tokens").insert({
          token,
          user_id: profile.id,
          company_id: profile.company_id,
          expires_at: exp,
        });
        await notifyEmail("password_reset", parsed.email, token);
        await logSecurityEvent(admin, profile.company_id as string, profile.id as string, "password_reset_requested", {});
        return jsonResponse({
          data: { ok: true },
          error: null,
          meta: {},
        });
      }

      case "password.confirm": {
        const { data: row } = await admin
          .from("password_reset_tokens")
          .select("user_id,company_id,expires_at,used")
          .eq("token", parsed.token)
          .maybeSingle();
        if (!row || row.used || new Date(row.expires_at as string) < new Date()) {
          return jsonResponse({
            data: null,
            error: { message: "Invalid or expired token" },
            meta: {},
          }, 400);
        }
        const { data: co } = await admin
          .from("companies")
          .select("password_policy")
          .eq("id", row.company_id as string)
          .maybeSingle();
        const policy = parsePolicy(co?.password_policy);
        const pwErr = validatePassword(parsed.password, policy);
        if (pwErr) {
          return jsonResponse({ data: null, error: { message: pwErr }, meta: {} }, 400);
        }
        const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id as string, {
          password: parsed.password,
        });
        if (updErr) {
          return jsonResponse({
            data: null,
            error: { message: updErr.message },
            meta: {},
          }, 400);
        }
        await admin.from("password_reset_tokens").update({ used: true }).eq("token", parsed.token);
        await logSecurityEvent(admin, row.company_id as string, row.user_id as string, "password_reset_completed", {});
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "verify.email": {
        const { data: row } = await admin
          .from("email_verification_tokens")
          .select("user_id,expires_at,used")
          .eq("token", parsed.token)
          .maybeSingle();
        if (!row || row.used || new Date(row.expires_at as string) < new Date()) {
          return jsonResponse({
            data: null,
            error: { message: "Invalid or expired verification link" },
            meta: {},
          }, 400);
        }
        const { error: vErr } = await admin.auth.admin.updateUserById(row.user_id as string, {
          email_confirm: true,
        });
        if (vErr) {
          return jsonResponse({
            data: null,
            error: { message: vErr.message },
            meta: {},
          }, 400);
        }
        await admin.from("email_verification_tokens").update({ used: true }).eq("token", parsed.token);
        const uid = row.user_id as string;
        const { data: prof } = await admin.from("profiles").select("company_id").eq("id", uid).maybeSingle();
        await logSecurityEvent(admin, prof?.company_id as string | null, uid, "email_verified", {});
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "profile.ensure": {
        const { userId, admin: svc } = await requireUser(req, supabaseUrl, anonKey);
        const { data: userRow, error: uErr } = await svc.auth.admin.getUserById(userId);
        if (uErr || !userRow.user?.email) {
          return jsonResponse(
            { data: null, error: { message: uErr?.message ?? "User not found" }, meta: {} },
            400,
          );
        }
        const user = userRow.user;
        const { data: existing } = await svc.from("profiles").select("id").eq("id", userId).maybeSingle();
        if (existing) {
          return jsonResponse({ data: { created: false }, error: null, meta: {} });
        }
        const meta = user.user_metadata as Record<string, unknown> | undefined;
        const companyId = typeof meta?.company_id === "string" ? meta.company_id : null;
        const displayName =
          typeof meta?.full_name === "string" ? meta.full_name : user.email.split("@")[0];
        const { error: insErr } = await svc.from("profiles").insert({
          id: userId,
          email: user.email,
          display_name: displayName,
          company_id: companyId,
          roles: companyId ? (["member"] as string[]) : ([] as string[]),
          auth_methods: ["oauth"],
        });
        if (insErr) {
          return jsonResponse({ data: null, error: { message: insErr.message }, meta: {} }, 400);
        }
        await logSecurityEvent(svc, companyId, userId, "profile_provisioned", {});
        return jsonResponse({ data: { created: true }, error: null, meta: {} });
      }

      case "profile.get": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const ext = await admin
          .from("external_accounts")
          .select("id,provider,linked_at,last_used_at,revoked")
          .eq("profile_id", userId);
        const keys = await admin
          .from("user_api_keys")
          .select("id,name,key_prefix,scopes,expires_at,status,created_at,last_used_at")
          .eq("profile_id", userId)
          .eq("status", "active");
        const events = await admin
          .from("auth_security_events")
          .select("event_type,payload,created_at")
          .eq("profile_id", userId)
          .order("created_at", { ascending: false })
          .limit(25);
        const companyId = bundle.profile?.company_id as string | null | undefined;
        let profileActivity: Record<string, unknown>[] = [];
        if (companyId) {
          const logs = await admin
            .from("activity_logs")
            .select("event_type,actor_user_id,payload,created_at")
            .eq("company_id", companyId)
            .eq("actor_user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20);
          profileActivity = Array.isArray(logs.data) ? (logs.data as Record<string, unknown>[]) : [];
        }
        const now = Date.now();
        const keyRows = Array.isArray(keys.data) ? keys.data : [];
        const apiKeys = keyRows.filter((k) => {
          const exp = (k as Record<string, unknown>).expires_at;
          if (typeof exp !== "string") return true;
          return new Date(exp).getTime() > now;
        });
        return jsonResponse({
          data: {
            profile: bundle.profile,
            tenant: bundle.company,
            externalAccounts: Array.isArray(ext.data) ? ext.data : [],
            apiKeys,
            securityEvents: Array.isArray(events.data) ? events.data : [],
            profileActivity,
          },
          error: null,
          meta: {},
        });
      }

      case "profile.update": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (parsed.displayName !== undefined) patch.display_name = parsed.displayName;
        if (parsed.avatarUrl !== undefined) {
          patch.avatar_url = parsed.avatarUrl === "" ? null : parsed.avatarUrl;
        }
        if (parsed.preferences !== undefined) patch.preferences = parsed.preferences;
        if (parsed.jobTitle !== undefined) patch.job_title = parsed.jobTitle.trim() || null;
        if (parsed.department !== undefined) patch.department = parsed.department.trim() || null;
        if (parsed.contactInfo !== undefined) patch.contact_info = parsed.contactInfo;
        if (parsed.bio !== undefined) patch.bio = parsed.bio.trim() || null;
        const { error: uErr } = await admin.from("profiles").update(patch).eq("id", userId);
        if (uErr) {
          return jsonResponse({
            data: null,
            error: { message: uErr.message },
            meta: {},
          }, 400);
        }
        const bundle = await fetchProfileBundle(admin, userId);
        return jsonResponse({ data: { profile: bundle.profile, tenant: bundle.company }, error: null, meta: {} });
      }

      case "apikeys.create": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        if (!bundle.profile?.company_id) {
          return jsonResponse({
            data: null,
            error: { message: "No tenant context" },
            meta: {},
          }, 400);
        }
        const st = (bundle.company?.settings as Record<string, unknown> | null) ?? {};
        const allow = st.allowUserApiKeys !== false;
        if (!allow) {
          return jsonResponse({
            data: null,
            error: { message: "API keys are disabled for this tenant" },
            meta: {},
          }, 403);
        }
        const raw = `caos_${randomToken()}`;
        const enc = new TextEncoder().encode(raw);
        const digest = await crypto.subtle.digest("SHA-256", enc);
        const hashHex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const prefix = raw.slice(0, 12);
        const scopes = Array.isArray(parsed.scopes) ? parsed.scopes : [];
        let expiresAt: string | null = null;
        if (parsed.expiresAt && typeof parsed.expiresAt === "string") {
          const d = new Date(parsed.expiresAt);
          if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
            expiresAt = d.toISOString();
          }
        }
        const { data: row, error: kErr } = await admin
          .from("user_api_keys")
          .insert({
            profile_id: userId,
            company_id: bundle.profile.company_id as string,
            name: parsed.name,
            key_prefix: prefix,
            key_hash: hashHex,
            scopes,
            expires_at: expiresAt,
            status: "active",
          })
          .select("id,name,key_prefix,scopes,expires_at,status,created_at")
          .single();
        if (kErr || !row) {
          return jsonResponse({
            data: null,
            error: { message: kErr?.message ?? "Could not create key" },
            meta: {},
          }, 400);
        }
        await logSecurityEvent(admin, bundle.profile.company_id as string, userId, "api_key_created", {
          keyId: row.id,
        });
        return jsonResponse({
          data: { key: row, secret: raw },
          error: null,
          meta: { warning: "Store the secret once; it cannot be retrieved again." },
        });
      }

      case "apikeys.list": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const { data: list } = await admin
          .from("user_api_keys")
          .select("id,name,key_prefix,scopes,expires_at,status,created_at,last_used_at")
          .eq("profile_id", userId)
          .eq("status", "active");
        return jsonResponse({
          data: { keys: Array.isArray(list) ? list : [] },
          error: null,
          meta: {},
        });
      }

      case "apikeys.revoke": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const { data: updated, error: dErr } = await admin
          .from("user_api_keys")
          .update({ status: "revoked" })
          .eq("id", parsed.keyId)
          .eq("profile_id", userId)
          .select("id")
          .maybeSingle();
        if (dErr) {
          return jsonResponse({
            data: null,
            error: { message: dErr.message },
            meta: {},
          }, 400);
        }
        if (!updated) {
          return jsonResponse({
            data: null,
            error: { message: "Key not found" },
            meta: {},
          }, 404);
        }
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "api_key_revoked",
          { keyId: parsed.keyId },
        );
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "apikeys.patch": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const patchRow: Record<string, unknown> = {};
        if (parsed.name !== undefined) patchRow.name = parsed.name.trim();
        if (parsed.scopes !== undefined) {
          patchRow.scopes = Array.isArray(parsed.scopes) ? parsed.scopes : [];
        }
        if (Object.keys(patchRow).length === 0) {
          return jsonResponse({ data: null, error: { message: "No updates" }, meta: {} }, 400);
        }
        const { data: row, error: pErr } = await admin
          .from("user_api_keys")
          .update(patchRow)
          .eq("id", parsed.keyId)
          .eq("profile_id", userId)
          .eq("status", "active")
          .select("id,name,key_prefix,scopes,expires_at,status,created_at,last_used_at")
          .maybeSingle();
        if (pErr) {
          return jsonResponse({ data: null, error: { message: pErr.message }, meta: {} }, 400);
        }
        if (!row) {
          return jsonResponse({ data: null, error: { message: "Key not found" }, meta: {} }, 404);
        }
        const bundle = await fetchProfileBundle(admin, userId);
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "api_key_patched",
          { keyId: parsed.keyId },
        );
        return jsonResponse({ data: { key: row }, error: null, meta: {} });
      }

      case "apikeys.rotate": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        if (!bundle.profile?.company_id) {
          return jsonResponse({
            data: null,
            error: { message: "No tenant context" },
            meta: {},
          }, 400);
        }
        const st = (bundle.company?.settings as Record<string, unknown> | null) ?? {};
        const allow = st.allowUserApiKeys !== false;
        if (!allow) {
          return jsonResponse({
            data: null,
            error: { message: "API keys are disabled for this tenant" },
            meta: {},
          }, 403);
        }
        const { data: existing, error: gErr } = await admin
          .from("user_api_keys")
          .select("id,name,scopes,expires_at")
          .eq("id", parsed.keyId)
          .eq("profile_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (gErr || !existing) {
          return jsonResponse({
            data: null,
            error: { message: gErr?.message ?? "Key not found" },
            meta: {},
          }, 404);
        }
        const raw = `caos_${randomToken()}`;
        const enc = new TextEncoder().encode(raw);
        const digest = await crypto.subtle.digest("SHA-256", enc);
        const hashHex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const prefix = raw.slice(0, 12);
        const scopes = Array.isArray((existing as Record<string, unknown>).scopes)
          ? (existing as { scopes: string[] }).scopes
          : [];
        const name =
          typeof (existing as Record<string, unknown>).name === "string"
            ? (existing as { name: string }).name
            : "Rotated key";
        let expiresAt: string | null = null;
        const exp = (existing as Record<string, unknown>).expires_at;
        if (typeof exp === "string") {
          const d = new Date(exp);
          if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
            expiresAt = d.toISOString();
          }
        }
        const { error: revErr } = await admin
          .from("user_api_keys")
          .update({ status: "revoked" })
          .eq("id", parsed.keyId)
          .eq("profile_id", userId);
        if (revErr) {
          return jsonResponse({ data: null, error: { message: revErr.message }, meta: {} }, 400);
        }
        const { data: row, error: kErr } = await admin
          .from("user_api_keys")
          .insert({
            profile_id: userId,
            company_id: bundle.profile.company_id as string,
            name: `${name} (rotated)`,
            key_prefix: prefix,
            key_hash: hashHex,
            scopes,
            expires_at: expiresAt,
            status: "active",
          })
          .select("id,name,key_prefix,scopes,expires_at,status,created_at")
          .single();
        if (kErr || !row) {
          return jsonResponse({
            data: null,
            error: { message: kErr?.message ?? "Could not create rotated key" },
            meta: {},
          }, 400);
        }
        await logSecurityEvent(admin, bundle.profile.company_id as string, userId, "api_key_rotated", {
          previousKeyId: parsed.keyId,
          newKeyId: row.id,
        });
        return jsonResponse({
          data: { key: row, secret: raw },
          error: null,
          meta: { warning: "Store the secret once; it cannot be retrieved again." },
        });
      }

      case "tenant.settings.get": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const roles = Array.isArray(bundle.profile?.roles) ? bundle.profile!.roles as string[] : [];
        if (!hasTenantAdminRole(roles)) {
          return jsonResponse({
            data: null,
            error: { message: "Insufficient permissions" },
            meta: {},
          }, 403);
        }
        return jsonResponse({
          data: { tenant: bundle.company },
          error: null,
          meta: {},
        });
      }

      case "tenant.settings.patch": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const roles = Array.isArray(bundle.profile?.roles) ? bundle.profile!.roles as string[] : [];
        if (!hasTenantAdminRole(roles)) {
          return jsonResponse({
            data: null,
            error: { message: "Insufficient permissions" },
            meta: {},
          }, 403);
        }
        const companyId = bundle.profile?.company_id as string | null | undefined;
        if (!companyId) {
          return jsonResponse({ data: null, error: { message: "No tenant" }, meta: {} }, 400);
        }
        const { data: co, error: coErr } = await admin
          .from("companies")
          .select("settings,sso_settings,password_policy")
          .eq("id", companyId)
          .maybeSingle();
        if (coErr || !co) {
          return jsonResponse({
            data: null,
            error: { message: coErr?.message ?? "Company not found" },
            meta: {},
          }, 400);
        }
        const rowPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (parsed.name !== undefined) rowPatch.name = parsed.name;
        if (parsed.timezone !== undefined) rowPatch.timezone = parsed.timezone;
        if (parsed.currency !== undefined) rowPatch.currency = parsed.currency;
        if (parsed.industry !== undefined) rowPatch.industry = parsed.industry;
        if (parsed.address !== undefined) rowPatch.address = parsed.address;
        if (parsed.contact_email !== undefined) rowPatch.contact_email = parsed.contact_email;
        if (parsed.settings !== undefined) {
          const prev =
            co.settings && typeof co.settings === "object" && !Array.isArray(co.settings)
              ? (co.settings as Record<string, unknown>)
              : {};
          rowPatch.settings = { ...prev, ...parsed.settings };
        }
        if (parsed.sso_settings !== undefined) {
          const prev =
            co.sso_settings && typeof co.sso_settings === "object" && !Array.isArray(co.sso_settings)
              ? (co.sso_settings as Record<string, unknown>)
              : {};
          rowPatch.sso_settings = { ...prev, ...parsed.sso_settings };
        }
        if (parsed.password_policy !== undefined) {
          const prev =
            co.password_policy && typeof co.password_policy === "object" &&
              !Array.isArray(co.password_policy)
              ? (co.password_policy as Record<string, unknown>)
              : {};
          rowPatch.password_policy = { ...prev, ...parsed.password_policy };
        }
        if (parsed.allowed_auth_methods !== undefined) {
          rowPatch.allowed_auth_methods = parsed.allowed_auth_methods;
        }
        const { error: uCo } = await admin.from("companies").update(rowPatch).eq("id", companyId);
        if (uCo) {
          return jsonResponse({ data: null, error: { message: uCo.message }, meta: {} }, 400);
        }
        const { data: fresh } = await admin
          .from("companies")
          .select(
            "id,name,domain,industry,timezone,currency,address,contact_email,sso_settings,password_policy,allowed_auth_methods,settings,created_at",
          )
          .eq("id", companyId)
          .maybeSingle();
        await logSecurityEvent(admin, companyId, userId, "tenant_settings_updated", {
          keys: Object.keys(rowPatch),
        });
        return jsonResponse({
          data: { tenant: fresh },
          error: null,
          meta: {},
        });
      }

      case "tenant.users.list": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const roles = Array.isArray(bundle.profile?.roles) ? bundle.profile!.roles as string[] : [];
        if (!hasTenantAdminRole(roles)) {
          return jsonResponse({
            data: null,
            error: { message: "Insufficient permissions" },
            meta: {},
          }, 403);
        }
        const companyId = bundle.profile?.company_id as string | null | undefined;
        if (!companyId) {
          return jsonResponse({ data: { users: [] }, error: null, meta: {} });
        }
        const { data: users, error: luErr } = await admin
          .from("profiles")
          .select("id,email,display_name,roles,status,created_at,job_title,department")
          .eq("company_id", companyId)
          .order("created_at", { ascending: true });
        if (luErr) {
          return jsonResponse({ data: null, error: { message: luErr.message }, meta: {} }, 400);
        }
        return jsonResponse({
          data: { users: Array.isArray(users) ? users : [] },
          error: null,
          meta: {},
        });
      }

      case "sso.unlink": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const { error: delErr } = await admin
          .from("external_accounts")
          .delete()
          .eq("profile_id", userId)
          .eq("provider", parsed.provider);
        if (delErr) {
          return jsonResponse({ data: null, error: { message: delErr.message }, meta: {} }, 400);
        }
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "sso_unlinked",
          { provider: parsed.provider },
        );
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "connections.disconnect": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        const { data: removed, error: delErr } = await admin
          .from("external_accounts")
          .delete()
          .eq("id", parsed.connectionId)
          .eq("profile_id", userId)
          .select("id")
          .maybeSingle();
        if (delErr) {
          return jsonResponse({ data: null, error: { message: delErr.message }, meta: {} }, 400);
        }
        if (!removed) {
          return jsonResponse({ data: null, error: { message: "Connection not found" }, meta: {} }, 404);
        }
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "connection_disconnected",
          { connectionId: parsed.connectionId },
        );
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "totp.enroll.start": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        if ((bundle.profile as Record<string, unknown> | null)?.totp_enabled === true) {
          return jsonResponse({
            data: null,
            error: { message: "TOTP already enabled" },
            meta: {},
          }, 400);
        }
        const secret = generateBase32Secret(20);
        const { error: enErr } = await admin.from("profile_totp_enrollment").upsert({
          profile_id: userId,
          secret_b32: secret,
          created_at: new Date().toISOString(),
        });
        if (enErr) {
          return jsonResponse({ data: null, error: { message: enErr.message }, meta: {} }, 400);
        }
        const issuer = typeof bundle.company?.name === "string"
          ? bundle.company.name
          : "Connected AI OS";
        const email =
          typeof bundle.profile?.email === "string" ? bundle.profile.email : userId;
        const label = encodeURIComponent(`${issuer}:${email}`);
        const secretParam = encodeURIComponent(secret);
        const otpauthUrl =
          `otpauth://totp/${label}?secret=${secretParam}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "totp_enroll_started",
          {},
        );
        return jsonResponse({
          data: { otpauthUrl, manualSecret: secret },
          error: null,
          meta: {},
        });
      }

      case "totp.enroll.verify": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const { data: row, error: eErr } = await admin
          .from("profile_totp_enrollment")
          .select("secret_b32")
          .eq("profile_id", userId)
          .maybeSingle();
        if (eErr || !row?.secret_b32) {
          return jsonResponse({
            data: null,
            error: { message: "No enrollment in progress" },
            meta: {},
          }, 400);
        }
        const ok = await verifyTotp(row.secret_b32 as string, parsed.code, 1);
        if (!ok) {
          return jsonResponse({ data: null, error: { message: "Invalid code" }, meta: {} }, 400);
        }
        await admin.from("profile_totp_enrollment").delete().eq("profile_id", userId);
        await admin.from("profile_totp_active").upsert({
          profile_id: userId,
          secret_b32: row.secret_b32 as string,
          created_at: new Date().toISOString(),
        });
        await admin
          .from("profiles")
          .update({ totp_enabled: true, updated_at: new Date().toISOString() })
          .eq("id", userId);
        const bundle = await fetchProfileBundle(admin, userId);
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "totp_enabled",
          {},
        );
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      case "totp.disable": {
        const { userId } = await requireUser(req, supabaseUrl, anonKey);
        const bundle = await fetchProfileBundle(admin, userId);
        if ((bundle.profile as Record<string, unknown> | null)?.totp_enabled !== true) {
          return jsonResponse({
            data: null,
            error: { message: "TOTP not enabled" },
            meta: {},
          }, 400);
        }
        const { data: active, error: aErr } = await admin
          .from("profile_totp_active")
          .select("secret_b32")
          .eq("profile_id", userId)
          .maybeSingle();
        if (aErr || !active?.secret_b32) {
          await admin
            .from("profiles")
            .update({ totp_enabled: false, updated_at: new Date().toISOString() })
            .eq("id", userId);
          return jsonResponse({ data: { ok: true }, error: null, meta: {} });
        }
        const valid = await verifyTotp(active.secret_b32 as string, parsed.code, 1);
        if (!valid) {
          return jsonResponse({ data: null, error: { message: "Invalid code" }, meta: {} }, 400);
        }
        await admin.from("profile_totp_active").delete().eq("profile_id", userId);
        await admin
          .from("profiles")
          .update({ totp_enabled: false, updated_at: new Date().toISOString() })
          .eq("id", userId);
        await logSecurityEvent(
          admin,
          (bundle.profile?.company_id as string | null) ?? null,
          userId,
          "totp_disabled",
          {},
        );
        return jsonResponse({ data: { ok: true }, error: null, meta: {} });
      }

      default:
        return jsonResponse({ data: null, error: { message: "Unknown op" }, meta: {} }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonResponse(
      {
        data: null,
        error: { message: e instanceof Error ? e.message : "Internal error" },
        meta: {},
      },
      500,
    );
  }
});
