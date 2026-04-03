/**
 * Prunes tenant activity_logs older than each company's activity_log_retention_days.
 * Invoke on a schedule (e.g. daily cron) with service role / internal auth.
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return json({ error: "Missing Supabase service configuration" }, 500);
  }

  const cronSecret = Deno.env.get("ACTIVITY_LOG_PRUNE_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-prune-secret");
    if (provided !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const admin = createClient(url, serviceKey);
  const { data: companies, error: cErr } = await admin
    .from("companies")
    .select("id, activity_log_retention_days");
  if (cErr) return json({ error: cErr.message }, 500);

  const list = Array.isArray(companies) ? companies : [];
  let deletedTotal = 0;

  for (const row of list) {
    const companyId = row.id as string;
    const daysRaw = row.activity_log_retention_days;
    const days = typeof daysRaw === "number" && daysRaw > 0 ? daysRaw : 365;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString();

    const { error: delErr, count } = await admin
      .from("activity_logs")
      .delete({ count: "exact" })
      .eq("company_id", companyId)
      .lt("created_at", cutoffIso);

    if (delErr) {
      return json({ error: delErr.message, companyId }, 500);
    }
    deletedTotal += count ?? 0;
  }

  return json({ ok: true, tenantsProcessed: list.length, rowsDeleted: deletedTotal });
});
