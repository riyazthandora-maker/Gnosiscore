-- ═══════════════════════════════════════════════════════════════
-- GnosisCore — Chapter & Document Management (Section 1)
-- Run in Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ── CHAPTERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chapters_owner" ON public.chapters;
DROP POLICY IF EXISTS "chapters_admin" ON public.chapters;
CREATE POLICY "chapters_owner" ON public.chapters
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chapters_admin" ON public.chapters
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_chapters_user ON public.chapters(user_id);

-- ── DOCUMENTS: add chapter_id column ──────────────────────────
ALTER TABLE IF EXISTS public.documents
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_chapter ON public.documents(chapter_id) WHERE chapter_id IS NOT NULL;

-- ── PLATFORM_SETTINGS: new limit columns ──────────────────────
ALTER TABLE IF EXISTS public.platform_settings
  ADD COLUMN IF NOT EXISTS max_storage_bytes    BIGINT NOT NULL DEFAULT 209715200,
  ADD COLUMN IF NOT EXISTS max_docs_per_chapter INT    NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS monthly_upload_limit INT    NOT NULL DEFAULT 100;

-- ── USERS: per-user storage override columns ──────────────────
-- NULL on any column means "use the platform default"
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS storage_limit_bytes  BIGINT,
  ADD COLUMN IF NOT EXISTS doc_size_limit_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS max_docs_per_chapter INT,
  ADD COLUMN IF NOT EXISTS monthly_upload_limit INT;
