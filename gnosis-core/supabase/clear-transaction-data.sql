-- ============================================================
-- GnosisCore — Clear ALL transaction data (full content wipe)
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- Deletes every row generated through app usage:
--   generation_requests, questions, tests, test_assignments,
--   test_attempts, notifications, books, book_collaborators, chapters
-- plus legacy tables (responses, test_configs, test_invitations,
--   diagnostic_reports, dashboard_shares) if they still exist.
--
-- KEEPS (account / reference data):
--   users, platform_settings, educator_students
--   (and resets users.tokens_used back to 0).
--
-- Whole script runs in one transaction — replace COMMIT with
-- ROLLBACK to preview without applying.
-- ============================================================

BEGIN;

-- ── 1. Transaction tables (public schema) ────────────────────
-- Deletes run in FK-safe order. Tables that don't exist yet are
-- skipped instead of erroring (e.g. books on a pre-books DB).
DO $$
DECLARE
  t    TEXT;
  n    BIGINT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'test_attempts',
    'responses',                 -- legacy
    'test_invitations',          -- legacy
    'test_assignments',
    'test_configs',              -- legacy
    'tests',
    'questions',
    'generation_requests',
    'dashboard_shares',          -- legacy
    'diagnostic_reports',        -- legacy
    'notifications',
    'book_collaborators',
    'books',
    'chapters'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', t);
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'Cleared public.% (% rows)', t, n;
    ELSE
      RAISE NOTICE 'Skipped public.% (table does not exist)', t;
    END IF;
  END LOOP;
END $$;

-- ── 2. Reset per-user token consumption counters ─────────────
-- Part of the transactional accounting — comment out if unwanted.
UPDATE public.users SET tokens_used = 0;

COMMIT;
