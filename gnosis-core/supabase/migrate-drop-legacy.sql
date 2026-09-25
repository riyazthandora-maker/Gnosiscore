-- ── RETIRE THE LEGACY EXAM SYSTEM ──────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- ⚠️  IRREVERSIBLE. Take a backup first (Dashboard → Database → Backups).
-- ⚠️  RUN ONLY AFTER the code changes that stop reading these tables are
--     DEPLOYED. Dropping them while the old code is still live will break
--     the educator dashboard, analytics, and admin pages.
--
-- These tables belong to the pre-Assign-Test architecture. All exam activity
-- now lives in exam_papers / exam_assignments / exam_sessions. The tables
-- below are empty of real data and have no remaining readers.
--
-- Verified before writing this file:
--   tests                → 0 rows for the only educator account
--   test_attempts        → 0 rows
--   educator_students    → 0 rows
--   Also confirmed no code path inserts into them after the code changes.

-- Drop dependents first (test_attempts and test_assignments reference tests).
DROP TABLE IF EXISTS public.test_attempts      CASCADE;
DROP TABLE IF EXISTS public.tests              CASCADE;
DROP TABLE IF EXISTS public.educator_students  CASCADE;

-- ── NOT dropped (still in use) ─────────────────────────────────────────────
-- public.questions        — the question bank, still written by the admin
--                           generation-request flow and read by
--                           /api/educator/questions
-- public.student_roster   — the source of truth for teacher↔student links
-- public.test_configs, public.test_invitations, public.responses,
-- public.diagnostic_reports, public.dashboard_shares — belong to the separate
-- invite/quiz and sharing features, which are unchanged.

-- ── Verify ─────────────────────────────────────────────────────────────────
--   SELECT to_regclass('public.tests')             AS tests,
--          to_regclass('public.test_attempts')     AS test_attempts,
--          to_regclass('public.educator_students') AS educator_students;
-- All three should return NULL.
