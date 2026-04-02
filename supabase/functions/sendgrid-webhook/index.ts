/**
 * SendGrid Event Webhook receiver — delivery/bounce events (extend to persist audit rows).
 * Configure webhook URL in SendGrid → Mail Settings → Event Webhook.
 * Validates optional SENDGRID_WEBHOOK_SECRET query or header if set.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const secret = Deno.env.get("SENDGRID_WEBHOOK_SECRET");
  if (secret) {
    const q = new URL(req.url).searchParams.get("secret");
    const h = req.headers.get("x-webhook-secret");
    if (q !== secret && h !== secret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload = await req.json().catch(() => []);
    const events = Array.isArray(payload) ? payload : [];
    return new Response(
      JSON.stringify({ received: events.length, ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
