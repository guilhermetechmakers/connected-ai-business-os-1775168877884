-- Notifications & alerts: durable in-app store, rules, schedules, preferences, channel settings.
-- Idempotent. company_id = tenant scope (matches existing schema).

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('kpi', 'workflow', 'ai')),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('system', 'in_app', 'email', 'push')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending', 'delivered', 'failed', 'acknowledged', 'dismissed')),
  related_item_id uuid,
  alert_rule_id uuid REFERENCES public.alert_rules (id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours jsonb,
  data_retention_days integer NOT NULL DEFAULT 365,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  cron_expression text NOT NULL,
  next_run_at timestamptz,
  payload_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_channel_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  sendgrid_from_email text,
  sendgrid_reply_to text,
  fcm_sender_id text,
  webhook_delivery_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('sendgrid', 'fcm')),
  encrypted_payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_notifications_company_user ON public.notifications (company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications (company_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON public.alert_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_company ON public.notification_schedules (company_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.notification_preferences (company_id, user_id);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_provider_credentials ENABLE ROW LEVEL SECURITY;

-- Profiles in same company can read alert rules; admins/managers mutate.
DROP POLICY IF EXISTS alert_rules_select ON public.alert_rules;
CREATE POLICY alert_rules_select ON public.alert_rules
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS alert_rules_insert ON public.alert_rules;
CREATE POLICY alert_rules_insert ON public.alert_rules
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

DROP POLICY IF EXISTS alert_rules_update ON public.alert_rules;
CREATE POLICY alert_rules_update ON public.alert_rules
  FOR UPDATE USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

DROP POLICY IF EXISTS alert_rules_delete ON public.alert_rules;
CREATE POLICY alert_rules_delete ON public.alert_rules
  FOR DELETE USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

-- In-app notifications: own rows; admins may insert for teammates.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.company_id = public.current_company_id()
          AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager']::text[]
      )
    )
  );

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

-- Preferences: self only.
DROP POLICY IF EXISTS notification_prefs_all ON public.notification_preferences;
CREATE POLICY notification_prefs_all ON public.notification_preferences
  FOR ALL USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

-- Schedules: read all in tenant; mutate for admins.
DROP POLICY IF EXISTS notification_schedules_select ON public.notification_schedules;
CREATE POLICY notification_schedules_select ON public.notification_schedules
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS notification_schedules_insert ON public.notification_schedules;
CREATE POLICY notification_schedules_insert ON public.notification_schedules
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

DROP POLICY IF EXISTS notification_schedules_update ON public.notification_schedules;
CREATE POLICY notification_schedules_update ON public.notification_schedules
  FOR UPDATE USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

DROP POLICY IF EXISTS notification_schedules_delete ON public.notification_schedules;
CREATE POLICY notification_schedules_delete ON public.notification_schedules
  FOR DELETE USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

-- Non-secret channel settings: visible to tenant; mutate admins.
DROP POLICY IF EXISTS notification_channel_settings_select ON public.notification_channel_settings;
CREATE POLICY notification_channel_settings_select ON public.notification_channel_settings
  FOR SELECT USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS notification_channel_settings_insert ON public.notification_channel_settings;
CREATE POLICY notification_channel_settings_insert ON public.notification_channel_settings
  FOR INSERT WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

DROP POLICY IF EXISTS notification_channel_settings_update ON public.notification_channel_settings;
CREATE POLICY notification_channel_settings_update ON public.notification_channel_settings
  FOR UPDATE USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id = public.current_company_id()
        AND p.roles && ARRAY['admin', 'owner', 'Tenant Admin', 'tenant_admin', 'manager', 'Integrations Lead']::text[]
    )
  );

-- Encrypted provider secrets: no direct client access (Edge Function uses service role).
DROP POLICY IF EXISTS notification_provider_credentials_deny ON public.notification_provider_credentials;
CREATE POLICY notification_provider_credentials_deny ON public.notification_provider_credentials
  FOR ALL USING (false)
  WITH CHECK (false);

-- Realtime: new in-app rows fan out to owners.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
