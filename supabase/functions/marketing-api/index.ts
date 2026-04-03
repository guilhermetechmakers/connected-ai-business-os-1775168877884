/**
 * Public marketing bundle for the landing page.
 * Integrates with: Postgres tables marketing_pricing_tiers, marketing_feature_highlights,
 * marketing_testimonials (optional). Returns JSON consumed by `fetchLandingMarketingBundle`.
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY (injected in Edge runtime).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase configuration" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [pricingRes, featuresRes, testimonialsRes] = await Promise.all([
    supabase
      .from("marketing_pricing_tiers")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("marketing_feature_highlights")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("marketing_testimonials")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const pricing = Array.isArray(pricingRes.data) ? pricingRes.data : [];
  const features = Array.isArray(featuresRes.data) ? featuresRes.data : [];
  const testimonials = Array.isArray(testimonialsRes.data)
    ? testimonialsRes.data
    : [];

  const body = {
    pricing,
    features,
    testimonials,
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
