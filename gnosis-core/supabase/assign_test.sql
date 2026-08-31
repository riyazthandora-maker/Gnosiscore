-- ── ASSIGN TEST MODULE ─────────────────────────────────────────────────────
-- Creates exam_assignments + exam_sessions tables with full Phase 2 config.
-- Run after existing schema.sql and assign.sql.

-- exam_assignments: one row per (paper, student) pair
CREATE TABLE IF NOT EXISTS exam_assignments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id                    uuid NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  student_roster_id           uuid NOT NULL REFERENCES student_roster(id) ON DELETE CASCADE,
  assigned_by                 uuid NOT NULL,
  assigned_at                 timestamptz NOT NULL DEFAULT now(),

  -- Timing & Access
  duration_minutes            integer NOT NULL DEFAULT 20,
  starts_at                   timestamptz,
  ends_at                     timestamptz,
  max_attempts                integer NOT NULL DEFAULT 3,

  -- Question & Answer Delivery
  randomize_questions         boolean NOT NULL DEFAULT false,
  shuffle_answers             boolean NOT NULL DEFAULT false,

  -- Navigation & Control
  allow_backtrack             boolean NOT NULL DEFAULT true,
  mandatory_answering         boolean NOT NULL DEFAULT false,
  flag_for_review             boolean NOT NULL DEFAULT true,

  -- Security & Anti-Cheating
  browser_lockdown            boolean NOT NULL DEFAULT false,
  disable_copy_paste          boolean NOT NULL DEFAULT false,
  tab_switch_warnings         boolean NOT NULL DEFAULT false,
  tab_switch_limit            integer NOT NULL DEFAULT 3,

  -- Results & Feedback
  release_results_immediately boolean NOT NULL DEFAULT true,
  show_explanations           boolean NOT NULL DEFAULT true,
  threshold_excellent         integer NOT NULL DEFAULT 90,
  threshold_distinction       integer NOT NULL DEFAULT 80,
  threshold_pass              integer NOT NULL DEFAULT 70,

  UNIQUE(paper_id, student_roster_id)
);

-- exam_sessions: one row per attempt
CREATE TABLE IF NOT EXISTS exam_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     uuid NOT NULL REFERENCES exam_assignments(id) ON DELETE CASCADE,
  student_user_id   uuid NOT NULL,
  status            text NOT NULL DEFAULT 'lobby'
                      CHECK (status IN ('lobby','in_progress','paused','submitted','auto_submitted')),
  attempt_number    integer NOT NULL DEFAULT 1,
  started_at        timestamptz,
  paused_at         timestamptz,
  elapsed_seconds   integer NOT NULL DEFAULT 0,
  answers           jsonb NOT NULL DEFAULT '{}',
  flagged_questions text[] NOT NULL DEFAULT '{}',
  tab_switch_count  integer NOT NULL DEFAULT 0,
  score             numeric(5,2),
  max_score         integer,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions    ENABLE ROW LEVEL SECURITY;

-- Educator manages their own assignments
CREATE POLICY "ea_educator_all" ON exam_assignments
  FOR ALL USING (assigned_by = auth.uid());

-- Student reads their own assignment (via student_roster link)
CREATE POLICY "ea_student_read" ON exam_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_roster sr
      WHERE sr.id = exam_assignments.student_roster_id
        AND sr.student_user_id = auth.uid()
    )
  );

-- Student manages their own sessions
CREATE POLICY "es_student_all" ON exam_sessions
  FOR ALL USING (student_user_id = auth.uid());

-- Educator reads sessions for their assignments
CREATE POLICY "es_educator_read" ON exam_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exam_assignments a
      WHERE a.id = exam_sessions.assignment_id
        AND a.assigned_by = auth.uid()
    )
  );
