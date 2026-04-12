-- Telegram Bot Integration
-- Enables companies to connect a Telegram bot so users can chat with the AI via Telegram.

-- telegram_bot_configs: one row per company, stores encrypted bot token + webhook routing secret
CREATE TABLE IF NOT EXISTS public.telegram_bot_configs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid        NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  encrypted_bot_token  text        NOT NULL,
  bot_username         text,
  bot_name             text,
  -- UUID used as the Telegram webhook secret_token (X-Telegram-Bot-Api-Secret-Token header)
  webhook_secret       text        NOT NULL DEFAULT gen_random_uuid()::text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_by           uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.telegram_bot_configs ENABLE ROW LEVEL SECURITY;

-- Admins/owners of the company can fully manage the bot config
CREATE POLICY "admins_manage_telegram_bot_configs"
  ON public.telegram_bot_configs
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND roles && ARRAY['admin', 'owner', 'super_admin', 'tenant_admin']
    )
  );

-- telegram_user_sessions: maps a Telegram chat to an AI conversation
CREATE TABLE IF NOT EXISTS public.telegram_user_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  telegram_chat_id    bigint      NOT NULL,
  telegram_user_id    bigint,
  telegram_username   text,
  telegram_first_name text,
  conversation_id     uuid        REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  last_message_at     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, telegram_chat_id)
);

ALTER TABLE public.telegram_user_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can view sessions (service role handles all writes via telegram-webhook)
CREATE POLICY "admins_view_telegram_user_sessions"
  ON public.telegram_user_sessions
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND roles && ARRAY['admin', 'owner', 'super_admin', 'tenant_admin']
    )
  );
