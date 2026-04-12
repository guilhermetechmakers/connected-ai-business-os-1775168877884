/**
 * telegram-setup-api — manages Telegram bot configuration per company.
 * JWT-authenticated; uses service-role for DB writes.
 *
 * Operations (op field in JSON body):
 *   bot.save   { botToken: string }  — validate token, encrypt, upsert config, register webhook
 *   bot.get                          — return bot username/status (no token)
 *   bot.remove                       — deregister Telegram webhook, delete config
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  decryptCredentialsJson,
  encryptCredentialsJson,
} from "../_shared/credentials-crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CREDENTIALS_MASTER_KEY = Deno.env.get("CREDENTIALS_MASTER_KEY") ?? "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Auth: verify JWT and get user + company ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("company_id, roles")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return json({ error: "No company associated with user" }, 403);
  }

  const isAdmin = Array.isArray(profile.roles) &&
    profile.roles.some((r: string) =>
      ["admin", "owner", "super_admin", "tenant_admin"].includes(r)
    );
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const companyId: string = profile.company_id;

  // Service-role client for DB writes
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { op } = body as { op: string };

    // ------------------------------------------------------------------ bot.get
    if (op === "bot.get") {
      const { data: config } = await adminClient
        .from("telegram_bot_configs")
        .select("id, bot_username, bot_name, is_active, created_at")
        .eq("company_id", companyId)
        .maybeSingle();

      return json({ config: config ?? null });
    }

    // ----------------------------------------------------------------- bot.save
    if (op === "bot.save") {
      const { botToken } = body as { botToken?: string };
      if (!botToken?.trim()) return json({ error: "botToken is required" }, 400);

      if (!CREDENTIALS_MASTER_KEY) {
        return json({ error: "Server not configured: missing CREDENTIALS_MASTER_KEY" }, 500);
      }

      // 1. Validate token via Telegram getMe
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const meData = await meRes.json();
      if (!meData.ok) {
        return json({ error: "Invalid bot token — Telegram rejected it" }, 400);
      }
      const botUsername: string = meData.result.username;
      const botName: string = meData.result.first_name;

      // 2. Encrypt bot token
      const encrypted = await encryptCredentialsJson(
        { bot_token: botToken },
        CREDENTIALS_MASTER_KEY,
      );

      // 3. Webhook secret (new on each save)
      const webhookSecret = crypto.randomUUID();

      // 4. Upsert config
      const { error: upsertError } = await adminClient
        .from("telegram_bot_configs")
        .upsert(
          {
            company_id: companyId,
            encrypted_bot_token: encrypted,
            bot_username: botUsername,
            bot_name: botName,
            webhook_secret: webhookSecret,
            is_active: true,
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" },
        );

      if (upsertError) {
        console.error("upsert error:", upsertError);
        return json({ error: "Failed to save configuration" }, 500);
      }

      // 5. Register webhook with Telegram
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook`;
      const whRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: webhookSecret,
            allowed_updates: ["message"],
          }),
        },
      );
      const whData = await whRes.json();
      if (!whData.ok) {
        console.error("setWebhook failed:", whData);
        // Config is saved; webhook registration failure is non-fatal but worth logging
      }

      return json({ ok: true, botUsername });
    }

    // --------------------------------------------------------------- bot.remove
    if (op === "bot.remove") {
      if (!CREDENTIALS_MASTER_KEY) {
        return json({ error: "Server not configured: missing CREDENTIALS_MASTER_KEY" }, 500);
      }

      // Fetch existing config to get the token for deregistration
      const { data: config } = await adminClient
        .from("telegram_bot_configs")
        .select("encrypted_bot_token")
        .eq("company_id", companyId)
        .maybeSingle();

      if (config) {
        try {
          const creds = await decryptCredentialsJson(
            config.encrypted_bot_token,
            CREDENTIALS_MASTER_KEY,
          );
          const botToken = creds.bot_token as string;
          await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
            method: "POST",
          });
        } catch {
          // Non-fatal — proceed with deletion regardless
        }
      }

      await adminClient
        .from("telegram_bot_configs")
        .delete()
        .eq("company_id", companyId);

      return json({ ok: true });
    }

    return json({ error: `Unknown op: ${op}` }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("telegram-setup-api error:", message);
    return json({ error: message }, 500);
  }
});
