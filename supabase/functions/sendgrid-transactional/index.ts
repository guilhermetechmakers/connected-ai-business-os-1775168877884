/**
 * SendGrid transactional mail API (v3 /mail/send).
 * Invoked from `notifications-api` or directly with service auth.
 * Secrets: reads API key from request body `apiKey` (server-to-server only) or Deno.env SENDGRID_API_KEY for smoke tests.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const bodySchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string().min(1).max(998),
  text: z.string().max(50000).optional(),
  html: z.string().max(100000).optional(),
  apiKey: z.string().min(10).optional(),
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
    parsed.data.apiKey?.trim() ||
    Deno.env.get("SENDGRID_API_KEY")?.trim() ||
    "";
  if (!key) {
    return json({ error: "Missing SendGrid API key (configure secret or tenant credentials)" }, 400);
  }

  const payload = {
    personalizations: [{ to: [{ email: parsed.data.to }] }],
    from: { email: parsed.data.from },
    subject: parsed.data.subject,
    content: [] as { type: string; value: string }[],
  };
  if (parsed.data.html) {
    payload.content.push({ type: "text/html", value: parsed.data.html });
  }
  if (parsed.data.text) {
    payload.content.push({ type: "text/plain", value: parsed.data.text });
  }
  if (payload.content.length === 0) {
    payload.content.push({ type: "text/plain", value: "(no body)" });
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    return json(
      { error: "SendGrid error", status: res.status, detail: errText.slice(0, 500) },
      502,
    );
  }

  return json({ ok: true });
});
