-- ============================================================
-- Pacing Module — Phase 1
-- Run in: Supabase Dashboard → SQL Editor → Run
-- Safe to re-run (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pacing_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id        UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  grade_id       UUID NOT NULL REFERENCES public.student_grades(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  academic_year  TEXT NOT NULL,
  start_month    INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pacing_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_plans' AND policyname = 'teachers_manage_own_plans') THEN
    CREATE POLICY "teachers_manage_own_plans" ON public.pacing_plans
      FOR ALL USING (teacher_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_plans' AND policyname = 'students_read_plans_for_grade') THEN
    CREATE POLICY "students_read_plans_for_grade" ON public.pacing_plans
      FOR SELECT USING (
        grade_id IN (
          SELECT grade_id FROM public.student_roster
          WHERE student_user_id = auth.uid() AND grade_id IS NOT NULL
        )
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pacing_milestones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES public.pacing_plans(id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,
  node_level     TEXT NOT NULL CHECK (node_level IN ('chapter','section','details')),
  node_title     TEXT NOT NULL,
  month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  week_in_month  INTEGER NOT NULL CHECK (week_in_month BETWEEN 1 AND 4),
  topic_notes    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, node_id)
);

ALTER TABLE public.pacing_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_milestones' AND policyname = 'teachers_manage_own_milestones') THEN
    CREATE POLICY "teachers_manage_own_milestones" ON public.pacing_milestones
      FOR ALL USING (
        plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_milestones' AND policyname = 'students_read_milestones') THEN
    CREATE POLICY "students_read_milestones" ON public.pacing_milestones
      FOR SELECT USING (
        plan_id IN (
          SELECT id FROM public.pacing_plans WHERE grade_id IN (
            SELECT grade_id FROM public.student_roster
            WHERE student_user_id = auth.uid() AND grade_id IS NOT NULL
          )
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pacing_milestones_plan_id ON public.pacing_milestones(plan_id);
