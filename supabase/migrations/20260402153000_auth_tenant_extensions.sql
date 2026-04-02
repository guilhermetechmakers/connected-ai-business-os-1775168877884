-- Auth & tenant identity extensions (idempotent). Edge Functions use service role for writes.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS domain text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sso_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS password_policy jsonb NOT NULL DEFAULT '{
    "minLength": 10,
    "requireSpecialChar": true,
    "requireNumbers": true,
    "requireUppercase": true
  }'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.external_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft', 'saml', 'oidc')),
  provider_user_id text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, provider)
);

CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL,
  ip text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time
  ON public.auth_login_attempts (email_normalized, attempted_at DESC);

CREATE TABLE IF NOT EXISTS public.auth_lockouts (
  email_normalized text PRIMARY KEY,
  failed_count int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_company ON public.invitations (company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token);
CREATE INDEX IF NOT EXISTS idx_external_accounts_profile ON public.external_accounts (profile_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_profile ON public.user_api_keys (profile_id);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_profile ON public.auth_security_events (profile_id, created_at DESC);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

-- No direct client access to lockouts / login_attempts / password_reset_tokens (service role only)
DROP POLICY IF EXISTS auth_login_attempts_deny ON public.auth_login_attempts;
CREATE POLICY auth_login_attempts_deny ON public.auth_login_attempts FOR ALL USING (false);

DROP POLICY IF EXISTS auth_lockouts_deny ON public.auth_lockouts;
CREATE POLICY auth_lockouts_deny ON public.auth_lockouts FOR ALL USING (false);

DROP POLICY IF EXISTS password_reset_tokens_deny ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_deny ON public.password_reset_tokens FOR ALL USING (false);

DROP POLICY IF EXISTS email_verification_tokens_deny ON public.email_verification_tokens;
CREATE POLICY email_verification_tokens_deny ON public.email_verification_tokens FOR ALL USING (false);

-- Invitations & security events: Edge Functions (service role) only
DROP POLICY IF EXISTS invitations_deny ON public.invitations;
CREATE POLICY invitations_deny ON public.invitations
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS external_accounts_select_self ON public.external_accounts;
CREATE POLICY external_accounts_select_self ON public.external_accounts
  FOR SELECT USING (profile_id = auth.uid() AND company_id = public.current_company_id());

DROP POLICY IF EXISTS user_api_keys_select_self ON public.user_api_keys;
CREATE POLICY user_api_keys_select_self ON public.user_api_keys
  FOR SELECT USING (profile_id = auth.uid() AND company_id = public.current_company_id());

DROP POLICY IF EXISTS auth_security_events_deny ON public.auth_security_events;
CREATE POLICY auth_security_events_deny ON public.auth_security_events
  FOR ALL USING (false) WITH CHECK (false);
