-- Chat-first AI control surface reframe:
-- - conversation execution mode (confirm/auto)
-- - assistant artifacts persisted on ai_messages
-- - export job file metadata for real PDF output

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'confirm';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_conversations_execution_mode_check'
      AND conrelid = 'public.ai_conversations'::regclass
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_execution_mode_check
      CHECK (execution_mode IN ('confirm', 'auto'));
  END IF;
END $$;

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS artifacts jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.report_export_jobs
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS download_url text;

CREATE INDEX IF NOT EXISTS idx_report_export_jobs_file_path
  ON public.report_export_jobs (file_path)
  WHERE file_path IS NOT NULL;

