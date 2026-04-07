/**
 * Email auth notifications — verification / password-reset delivery via Resend.
 * Invoked by auth-api with service role.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { sendResendEmail, type ResendEmailError } from "../_shared/resend-mail.ts";

const bodySchema = z.object({
  kind: z.enum(["verification", "password_reset"]),
  to: z.string().email(),
  token: z.string().min(4),
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAppBaseUrl(): string {
  const appUrl = Deno.env.get("APP_URL")?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const fallback = Deno.env.get("SITE_URL")?.trim();
  if (fallback) return fallback.replace(/\/+$/, "");
  throw new Error("APP_URL not configured");
}

function buildEmailContent(
  kind: "verification" | "password_reset",
  appBaseUrl: string,
  token: string,
): { subject: string; text: string } {
  const encodedToken = encodeURIComponent(token);
  if (kind === "verification") {
    const verifyUrl = `${appBaseUrl}/verify-email?token=${encodedToken}`;
    return {
      subject: "Verify your email address",
      text:
        `Welcome to Connected AI Business OS.\n\n` +
        `Verify your email by opening this link:\n${verifyUrl}\n\n` +
        `If you did not request this, you can ignore this email.`,
    };
  }
  const resetUrl = `${appBaseUrl}/password-reset?token=${encodedToken}`;
  return {
    subject: "Reset your password",
    text:
      `A password reset was requested for your account.\n\n` +
      `Reset your password using this link:\n${resetUrl}\n\n` +
      `If you did not request this, you can ignore this email.`,
  };
}

function getAuthFromEmail(): string {
  const value =
    Deno.env.get("AUTH_FROM_EMAIL")?.trim() ||
    Deno.env.get("RESEND_FROM_EMAIL")?.trim() ||
    "";
  if (!value) {
    throw new Error("AUTH_FROM_EMAIL not configured");
  }
  return value;
}

function isResendError(value: unknown): value is ResendEmailError {
  if (!(value instanceof Error)) return false;
  const x = value as ResendEmailError;
  return typeof x.status === "number" || typeof x.detail === "string";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const apiKey = req.headers.get("apikey") ?? "";
    if (bearer !== serviceRoleKey && apiKey !== serviceRoleKey) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return jsonResponse({ ok: false, error: "Invalid body" }, 400);
    }

    const appBaseUrl = getAppBaseUrl();
    const from = getAuthFromEmail();
    const content = buildEmailContent(parsed.data.kind, appBaseUrl, parsed.data.token);
    await sendResendEmail({
      from,
      to: parsed.data.to,
      subject: content.subject,
      text: content.text,
    });
    return jsonResponse({ ok: true, queued: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("email-auth-notifications failed:", message);

    if (message === "APP_URL not configured" || message === "AUTH_FROM_EMAIL not configured") {
      return jsonResponse({ ok: false, error: message }, 500);
    }

    if (isResendError(error)) {
      return jsonResponse(
        {
          ok: false,
          error: "Resend send failed",
          detail: error.detail ?? message,
        },
        502,
      );
    }

    return jsonResponse({ ok: false, error: "Bad request" }, 400);
  }
});
