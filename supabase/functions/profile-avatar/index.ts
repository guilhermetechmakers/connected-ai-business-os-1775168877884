/**
 * Profile avatar upload — validates image payload, stores in public `avatars` bucket,
 * records `avatar_assets`, updates `profiles.avatar_url`. Requires JWT; path is tenant-scoped.
 * Client: supabase.functions.invoke('profile-avatar', { body: { imageBase64, mimeType } }).
 * Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.25.76";
import { corsHeaders } from "../_shared/cors.ts";

const bodySchema = z.object({
  imageBase64: z.string().min(20).max(6_000_000),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<{ userId: string; admin: SupabaseClient }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ data: null, error: { message: "Unauthorized" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const jwt = authHeader.slice(7);
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    throw new Response(
      JSON.stringify({ data: null, error: { message: "Invalid session" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return { userId: data.user.id, admin };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ data: null, error: { message: "Server misconfigured" } }, 500);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    const r = bodySchema.safeParse(raw);
    if (!r.success) {
      return jsonResponse(
        { data: null, error: { message: "Invalid request", details: r.error.flatten() } },
        400,
      );
    }
    parsed = r.data;
  } catch {
    return jsonResponse({ data: null, error: { message: "Invalid JSON" } }, 400);
  }

  try {
    const { userId, admin } = await requireUser(req, supabaseUrl, anonKey);

    let binary: Uint8Array;
    try {
      binary = Uint8Array.from(atob(parsed.imageBase64), (c) => c.charCodeAt(0));
    } catch {
      return jsonResponse({ data: null, error: { message: "Invalid base64 image" } }, 400);
    }

    const maxBytes = 2_000_000;
    if (binary.length > maxBytes) {
      return jsonResponse(
        { data: null, error: { message: `Image too large (max ${maxBytes} bytes)` } },
        400,
      );
    }

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !prof?.company_id) {
      return jsonResponse({ data: null, error: { message: "No tenant context" } }, 400);
    }

    const ext =
      parsed.mimeType === "image/png" ? "png" : parsed.mimeType === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await admin.storage.from("avatars").upload(path, binary, {
      contentType: parsed.mimeType,
      upsert: false,
    });
    if (upErr) {
      return jsonResponse({ data: null, error: { message: upErr.message } }, 400);
    }

    const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    await admin.from("avatar_assets").insert({
      profile_id: userId,
      company_id: prof.company_id as string,
      url: publicUrl,
      size_bytes: binary.length,
      mime_type: parsed.mimeType,
    });

    await admin
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);

    await admin.from("auth_security_events").insert({
      company_id: prof.company_id as string,
      profile_id: userId,
      event_type: "avatar_updated",
      payload: { path },
    });

    return jsonResponse({ data: { url: publicUrl }, error: null, meta: {} });
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonResponse(
      {
        data: null,
        error: { message: e instanceof Error ? e.message : "Internal error" },
      },
      500,
    );
  }
});
