-- Section 4: Add scheduling and policy columns to test_assignments
ALTER TABLE test_assignments
  ADD COLUMN IF NOT EXISTS time_limit_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS show_timer         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_answer_key    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_retake       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS starts_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at            timestamptz;
