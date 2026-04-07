/**
 * Transactional mail API via Resend.
 * Invoked from `notifications-api` or directly with service auth.
 * Secrets: reads API key from request body `resendApiKey` (server-to-server only) or Deno.env RESEND_API_KEY for smoke tests.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";
import { sendResendEmail } from "../_shared/resend-mail.ts";

const bodySchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string().min(1).max(998),
  text: z.string().max(50000).optional(),
  html: z.string().max(100000).optional(),
  resendApiKey: z.string().min(10).optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 422);

  const key =
    parsed.data.resendApiKey?.trim() ||
    Deno.env.get("RESEND_API_KEY")?.trim() ||
    "";
  if (!key) {
    return json({ error: "Missing Resend API key (configure secret or tenant credentials)" }, 400);
  }
  try {
    await sendResendEmail({
      from: parsed.data.from,
      to: parsed.data.to,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: parsed.data.html,
      apiKey: key,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Resend error";
    return json({ error: "Resend error", detail }, 502);
  }

  return json({ ok: true });
});
