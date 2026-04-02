/**
 * Firebase Cloud Messaging — legacy HTTP API (server key).
 * Prefer HTTP v1 in production; this supports tenant server keys stored encrypted.
 * Invoked from `notifications-api` with decrypted server key in body (server-to-server only).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const bodySchema = z.object({
  serverKey: z.string().min(20),
  deviceToken: z.string().min(10),
  title: z.string().min(1).max(200),
  body: z.string().max(4000),
  data: z.record(z.string()).optional(),
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

  const fcmPayload = {
    to: parsed.data.deviceToken,
    notification: {
      title: parsed.data.title,
      body: parsed.data.body,
    },
    data: parsed.data.data ?? {},
    priority: "high" as const,
  };

  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${parsed.data.serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fcmPayload),
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json(
      { error: "FCM error", status: res.status, detail: j },
      502,
    );
  }

  return json({ ok: true, result: j });
});
