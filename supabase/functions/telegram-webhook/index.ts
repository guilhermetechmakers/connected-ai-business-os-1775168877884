/**
 * telegram-webhook — receives updates from Telegram, runs them through the AI, replies.
 *
 * Called by Telegram servers (no user JWT).
 * Authentication: X-Telegram-Bot-Api-Secret-Token header matched against telegram_bot_configs.webhook_secret.
 * Uses service-role Supabase client for all DB access.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptCredentialsJson } from "../_shared/credentials-crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CREDENTIALS_MASTER_KEY = Deno.env.get("CREDENTIALS_MASTER_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SYSTEM_PROMPT =
  "You are a helpful AI assistant. Answer questions clearly and concisely.";

serve(async (req) => {
  // Telegram only sends POST; ignore other methods
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // --- Verify Telegram webhook secret ---
  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!secret) return new Response("Forbidden", { status: 403 });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: config } = await adminClient
    .from("telegram_bot_configs")
    .select("id, company_id, encrypted_bot_token")
    .eq("webhook_secret", secret)
    .eq("is_active", true)
    .maybeSingle();

  if (!config) return new Response("Forbidden", { status: 403 });

  // --- Parse Telegram update ---
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = update?.message as Record<string, unknown> | undefined;

  // Only handle text messages; silently ack everything else
  if (!message?.text) {
    return new Response("OK", { status: 200 });
  }

  const chatId = (message.chat as Record<string, unknown>)?.id as number;
  const from = message.from as Record<string, unknown> | undefined;
  const telegramUserId = from?.id as number | undefined;
  const telegramUsername = from?.username as string | undefined;
  const telegramFirstName = from?.first_name as string | undefined;
  const userText = message.text as string;

  const { company_id: companyId, encrypted_bot_token: encryptedToken } = config;

  // Decrypt bot token for sending the reply
  let botToken: string;
  try {
    const creds = await decryptCredentialsJson(encryptedToken, CREDENTIALS_MASTER_KEY);
    botToken = creds.bot_token as string;
  } catch (e) {
    console.error("Failed to decrypt bot token:", e);
    return new Response("Internal Server Error", { status: 500 });
  }

  // --- Find or create a Telegram user session ---
  let { data: session } = await adminClient
    .from("telegram_user_sessions")
    .select("id, conversation_id")
    .eq("company_id", companyId)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!session) {
    // Create a new AI conversation for this Telegram chat
    const displayName = telegramFirstName ?? telegramUsername ?? String(chatId);
    const { data: conv, error: convError } = await adminClient
      .from("ai_conversations")
      .insert({
        company_id: companyId,
        user_id: null, // Telegram users have no app account
        mode: "Ask",
        title: `Telegram: ${displayName}`,
      })
      .select("id")
      .single();

    if (convError || !conv) {
      console.error("Failed to create conversation:", convError);
      return new Response("Internal Server Error", { status: 500 });
    }

    const { data: newSession, error: sessionError } = await adminClient
      .from("telegram_user_sessions")
      .insert({
        company_id: companyId,
        telegram_chat_id: chatId,
        telegram_user_id: telegramUserId ?? null,
        telegram_username: telegramUsername ?? null,
        telegram_first_name: telegramFirstName ?? null,
        conversation_id: conv.id,
      })
      .select("id, conversation_id")
      .single();

    if (sessionError || !newSession) {
      console.error("Failed to create session:", sessionError);
      return new Response("Internal Server Error", { status: 500 });
    }

    session = newSession;
  }

  const conversationId: string = session.conversation_id;

  // --- Store user message ---
  await adminClient.from("ai_messages").insert({
    conversation_id: conversationId,
    company_id: companyId,
    role: "user",
    content: userText,
  });

  // --- Fetch recent conversation history (last 20 messages) ---
  const { data: history } = await adminClient
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // --- Call OpenAI ---
  const openaiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...((history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }))),
  ];

  let aiText = "Sorry, I couldn't generate a response right now. Please try again.";

  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
  } else {
    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: openaiMessages }),
      });
      const openaiData = await openaiRes.json();
      const choice = openaiData?.choices?.[0]?.message?.content;
      if (typeof choice === "string" && choice.length > 0) {
        aiText = choice;
      }
    } catch (e) {
      console.error("OpenAI call failed:", e);
    }
  }

  // --- Store assistant reply ---
  await adminClient.from("ai_messages").insert({
    conversation_id: conversationId,
    company_id: companyId,
    role: "assistant",
    content: aiText,
  });

  // --- Update session last_message_at ---
  await adminClient
    .from("telegram_user_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", session.id);

  // --- Send reply via Telegram ---
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiText,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("Failed to send Telegram message:", e);
  }

  // Telegram expects a 200 OK quickly
  return new Response("OK", { status: 200 });
});
