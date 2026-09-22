-- ============================================================
-- Phase 2A: Scheduling Engine Foundation
-- Run AFTER pacing.sql
-- Safe to re-run (idempotent)
-- ============================================================

-- ── milestone_type ENUM ───────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE milestone_type AS ENUM ('teach', 'revise', 'assess');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── pacing_milestones: new columns ────────────────────────────
ALTER TABLE public.pacing_milestones
  ADD COLUMN IF NOT EXISTS milestone_type milestone_type NOT NULL DEFAULT 'teach';

ALTER TABLE public.pacing_milestones
  ADD COLUMN IF NOT EXISTS auto_exam_paper_id UUID
    REFERENCES public.exam_papers(id) ON DELETE SET NULL;

ALTER TABLE public.pacing_milestones
  ADD COLUMN IF NOT EXISTS auto_exam_status TEXT
    CHECK (auto_exam_status IN ('pending_review', 'approved', 'assigned'));

-- ── pacing_plans: new columns ─────────────────────────────────
ALTER TABLE public.pacing_plans
  ADD COLUMN IF NOT EXISTS auto_assess_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pacing_plans
  ADD COLUMN IF NOT EXISTS difficulty_bands JSONB NOT NULL
    DEFAULT '{"low":[60,70],"medium":[70,80],"high":[80,100]}';

ALTER TABLE public.pacing_plans
  ADD COLUMN IF NOT EXISTS auto_question_count INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.pacing_plans
  ADD COLUMN IF NOT EXISTS auto_duration_minutes INTEGER NOT NULL DEFAULT 10;

-- ── pacing_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacing_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES public.pacing_plans(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'auto_exam_generated',
                  'auto_exam_approved',
                  'auto_exam_assigned',
                  'reschedule_suggested',
                  'reschedule_applied',
                  'remediation_suggested',
                  'remediation_applied'
                )),
  payload       JSONB NOT NULL DEFAULT '{}',
  triggered_by  TEXT NOT NULL DEFAULT 'system',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pacing_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pacing_events' AND policyname = 'events_plan_owner'
  ) THEN
    CREATE POLICY "events_plan_owner" ON public.pacing_events
      FOR ALL USING (
        plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pacing_events_plan
  ON public.pacing_events(plan_id, created_at DESC);

-- ── pacing_suggestions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacing_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.pacing_plans(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('reschedule', 'insert_revise')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'applied', 'dismissed')),
  payload         JSONB NOT NULL DEFAULT '{}',
  ai_reasoning    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  acted_at        TIMESTAMPTZ
);

ALTER TABLE public.pacing_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pacing_suggestions' AND policyname = 'suggestions_plan_owner'
  ) THEN
    CREATE POLICY "suggestions_plan_owner" ON public.pacing_suggestions
      FOR ALL USING (
        plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pacing_suggestions_plan_status
  ON public.pacing_suggestions(plan_id, status);

-- ── RPC: get milestones pending auto-exam generation ──────────
-- Returns assess-type milestones whose slot starts within
-- p_days_ahead days and haven't been auto-generated yet.
-- Called by the auto-assess cron with service-role key.
CREATE OR REPLACE FUNCTION public.get_pending_auto_assess_milestones(
  p_days_ahead INTEGER DEFAULT 5
)
RETURNS TABLE (
  milestone_id          UUID,
  plan_id               UUID,
  teacher_id            UUID,
  grade_id              UUID,
  book_id               UUID,
  start_month           INTEGER,
  academic_year         TEXT,
  node_id               TEXT,
  node_title            TEXT,
  month                 INTEGER,
  week_in_month         INTEGER,
  difficulty_bands      JSONB,
  auto_question_count   INTEGER,
  auto_duration_minutes INTEGER
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    pm.id,
    pp.id,
    pp.teacher_id,
    pp.grade_id,
    pp.book_id,
    pp.start_month,
    pp.academic_year,
    pm.node_id,
    pm.node_title,
    pm.month,
    pm.week_in_month,
    pp.difficulty_bands,
    pp.auto_question_count,
    pp.auto_duration_minutes
  FROM public.pacing_milestones pm
  JOIN public.pacing_plans pp ON pp.id = pm.plan_id
  WHERE pm.milestone_type = 'assess'
    AND pm.auto_exam_paper_id IS NULL
    AND pp.auto_assess_enabled = true
    AND make_date(
      CASE WHEN pm.month >= pp.start_month
        THEN SPLIT_PART(pp.academic_year, '-', 1)::INT
        ELSE SPLIT_PART(pp.academic_year, '-', 2)::INT
      END,
      pm.month,
      LEAST(pm.week_in_month * 7, 28)
    ) BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead);
$$;
