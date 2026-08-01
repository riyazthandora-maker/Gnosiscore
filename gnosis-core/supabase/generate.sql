-- ═══════════════════════════════════════════════════════════════
-- GnosisCore — Revamped Generate Test (Section 2)
-- Run in Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- Extend generation_requests with chapter-based generation fields
ALTER TABLE IF EXISTS public.generation_requests
  ADD COLUMN IF NOT EXISTS chapter_ids  UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prompt_pct   INT     NOT NULL DEFAULT 0
    CHECK (prompt_pct >= 0 AND prompt_pct <= 100),
  ADD COLUMN IF NOT EXISTS toughness    INT     NOT NULL DEFAULT 50
    CHECK (toughness >= 0 AND toughness <= 100);

-- Per-user question approval threshold override (NULL = use platform default)
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS question_approval_threshold INT;

CREATE INDEX IF NOT EXISTS idx_gen_requests_chapter_ids
  ON public.generation_requests USING GIN (chapter_ids);
