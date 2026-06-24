-- ============================================================
-- GnosisCore Phase 2 — Migration
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── PLATFORM SETTINGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  file_size_limit_bytes       BIGINT  NOT NULL DEFAULT 4194304,   -- 4 MB
  question_approval_threshold INT     NOT NULL DEFAULT 20,
  max_pause_duration_seconds  INT     NOT NULL DEFAULT 900,       -- 15 min
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row (idempotent)
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_all"  ON public.platform_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.platform_settings;
CREATE POLICY "settings_read_all"    ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.platform_settings FOR UPDATE USING (public.is_admin());

-- ── USERS: is_active ─────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── TESTS: allow_pause ───────────────────────────────────────
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS allow_pause BOOLEAN NOT NULL DEFAULT false;

-- ── TEST ATTEMPTS: retake + pause tracking ───────────────────
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS attempt_number         INT          NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_first_attempt       BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS paused_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_paused_seconds   INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at      TIMESTAMPTZ  DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS question_order         JSONB        DEFAULT '[]';

-- Index for heartbeat staleness check
CREATE INDEX IF NOT EXISTS idx_attempts_incomplete
  ON public.test_attempts(last_heartbeat_at)
  WHERE completed_at IS NULL;

-- Index for per-student first-attempt lookup by teachers
CREATE INDEX IF NOT EXISTS idx_attempts_first
  ON public.test_attempts(test_id, student_id)
  WHERE is_first_attempt = true;

-- ── RPC: atomic token reset ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_all_educator_tokens()
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.users SET tokens_used = 0 WHERE role = 'educator_parent';
$$;
