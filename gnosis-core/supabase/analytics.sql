-- ============================================================
-- Phase 2D: Cohort Analytics — SQL view
-- Run AFTER scheduling-foundation.sql
-- Safe to re-run
-- ============================================================

-- ── cohort_pacing_stats ───────────────────────────────────────
-- Per-milestone aggregation of exam completion + scores.
-- Respects RLS: pacing_milestones filtered to teacher's plans,
-- exam_assignments filtered to assignments created by teacher.
CREATE OR REPLACE VIEW public.cohort_pacing_stats AS
SELECT
  pm.id                                                                          AS milestone_id,
  pm.plan_id,
  pm.node_title,
  pm.milestone_type,
  pm.month,
  pm.week_in_month,
  pm.auto_exam_paper_id,
  COUNT(DISTINCT ea.id)::int                                                     AS total_assigned,
  COUNT(DISTINCT
    CASE WHEN es.status IN ('submitted','auto_submitted')
         THEN ea.student_roster_id END
  )::int                                                                         AS completed_count,
  CASE
    WHEN COUNT(DISTINCT ea.id) = 0 THEN 0::numeric
    ELSE ROUND(
      COUNT(DISTINCT CASE WHEN es.status IN ('submitted','auto_submitted')
                          THEN ea.student_roster_id END)::numeric
      / COUNT(DISTINCT ea.id) * 100, 1
    )
  END                                                                            AS completion_rate_pct,
  ROUND(
    AVG(
      CASE
        WHEN es.status IN ('submitted','auto_submitted')
         AND es.max_score IS NOT NULL
         AND es.max_score > 0
        THEN (es.score / es.max_score * 100)::numeric
      END
    ), 1
  )                                                                              AS avg_score_pct
FROM  public.pacing_milestones  pm
LEFT  JOIN public.exam_assignments ea ON ea.paper_id = pm.auto_exam_paper_id
LEFT  JOIN public.exam_sessions    es ON es.assignment_id = ea.id
GROUP BY
  pm.id, pm.plan_id, pm.node_title, pm.milestone_type,
  pm.month, pm.week_in_month, pm.auto_exam_paper_id;
