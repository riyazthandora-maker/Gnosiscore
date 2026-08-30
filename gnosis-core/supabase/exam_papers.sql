-- Migration: exam_papers table
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE public.exam_papers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  questions   JSONB       NOT NULL DEFAULT '[]',
  source_meta JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- questions JSONB array element shape:
-- { id: string, body: string, options: {A,B,C,D: string},
--   correct: "A"|"B"|"C"|"D", difficulty: "easy"|"hard",
--   explanation: string, topic: string }

-- source_meta shape:
-- { books: [{id, title, selected_blocks: [{id, level, text}]}],
--   weightages: {[blockId]: number}, settings: {total: number, easy_pct: number} }

ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_papers_owner" ON public.exam_papers
  USING  (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE INDEX idx_exam_papers_teacher
  ON public.exam_papers (teacher_id, created_at DESC);
