-- Replace month+week_in_month with a single scheduled_date column

ALTER TABLE public.pacing_milestones
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;

ALTER TABLE public.pacing_milestones
  DROP COLUMN IF EXISTS month,
  DROP COLUMN IF EXISTS week_in_month;

-- Update the auto-assess cron RPC to use scheduled_date
DROP FUNCTION IF EXISTS get_pending_auto_assess_milestones(INT);

CREATE OR REPLACE FUNCTION get_pending_auto_assess_milestones(p_days_ahead INT DEFAULT 7)
RETURNS TABLE (
  milestone_id    UUID,
  plan_id         UUID,
  node_id         TEXT,
  node_title      TEXT,
  scheduled_date  DATE
) LANGUAGE sql STABLE AS $$
  SELECT
    pm.id           AS milestone_id,
    pm.plan_id      AS plan_id,
    pm.node_id      AS node_id,
    pm.node_title   AS node_title,
    pm.scheduled_date
  FROM public.pacing_milestones pm
  JOIN public.pacing_plans pp ON pp.id = pm.plan_id
  WHERE pm.auto_exam_paper_id IS NULL
    AND pp.auto_assess_enabled = true
    AND pm.scheduled_date IS NOT NULL
    AND pm.scheduled_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_ahead);
$$;
