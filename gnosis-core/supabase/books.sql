-- ── BOOKS ────────────────────────────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Step 3: persistence + collaboration schema

DO $$ BEGIN
  CREATE TYPE book_collab_role AS ENUM ('editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  blocks     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.book_collaborators (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id  UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role     book_collab_role NOT NULL DEFAULT 'viewer',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (book_id, user_id)
);

CREATE OR REPLACE FUNCTION public.touch_book_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS books_touch_updated_at ON public.books;
CREATE TRIGGER books_touch_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.touch_book_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "books_owner_all"      ON public.books;
DROP POLICY IF EXISTS "books_collab_select"  ON public.books;
DROP POLICY IF EXISTS "books_editor_update"  ON public.books;

CREATE POLICY "books_owner_all" ON public.books
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "books_collab_select" ON public.books
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.book_collaborators bc
      WHERE bc.book_id = id AND bc.user_id = auth.uid()
    )
  );

CREATE POLICY "books_editor_update" ON public.books
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.book_collaborators bc
      WHERE bc.book_id = id AND bc.user_id = auth.uid() AND bc.role = 'editor'
    )
  );

DROP POLICY IF EXISTS "book_collabs_owner_all" ON public.book_collaborators;
DROP POLICY IF EXISTS "book_collabs_self_read" ON public.book_collaborators;

CREATE POLICY "book_collabs_owner_all" ON public.book_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = book_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "book_collabs_self_read" ON public.book_collaborators
  FOR SELECT USING (user_id = auth.uid());
