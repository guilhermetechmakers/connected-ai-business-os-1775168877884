-- Rename notifications email provider contracts from SendGrid to Resend.
-- Idempotent migration for existing environments.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_channel_settings'
      AND column_name = 'sendgrid_from_email'
  ) THEN
    ALTER TABLE public.notification_channel_settings
      RENAME COLUMN sendgrid_from_email TO resend_from_email;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_channel_settings'
      AND column_name = 'sendgrid_reply_to'
  ) THEN
    ALTER TABLE public.notification_channel_settings
      RENAME COLUMN sendgrid_reply_to TO resend_reply_to;
  END IF;
END $$;

ALTER TABLE public.notification_provider_credentials
  DROP CONSTRAINT IF EXISTS notification_provider_credentials_provider_check;

-- Migrate provider identifiers before adding the stricter constraint.
UPDATE public.notification_provider_credentials c
SET provider = 'resend'
WHERE c.provider = 'sendgrid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notification_provider_credentials x
    WHERE x.company_id = c.company_id
      AND x.provider = 'resend'
  );

-- Remove deprecated provider rows that can no longer satisfy the new check.
DELETE FROM public.notification_provider_credentials
WHERE provider = 'sendgrid';

ALTER TABLE public.notification_provider_credentials
  ADD CONSTRAINT notification_provider_credentials_provider_check
  CHECK (provider IN ('resend', 'fcm'));
