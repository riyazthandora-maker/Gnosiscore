-- ── FIX: MISSING public.users PROFILE ROWS ─────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- WHY: `reset.sql` drops the `on_auth_user_created` trigger, and only
-- `schema.sql` recreates it. Any user who signed up while the trigger was
-- absent (all of our students) has an `auth.users` row but no `public.users`
-- profile row. That breaks invite claiming, roster auto-linking, and every
-- query that reads a student's name/email from `public.users`.
--
-- This script is idempotent — safe to run more than once.
-- 1. Recreates the trigger so FUTURE signups get a profile row.
-- 2. Backfills profile rows for EXISTING auth users.

-- ── 1. Recreate the trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role   user_role;
  v_status account_status;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'student'::user_role
  );
  v_status := CASE
    WHEN v_role = 'educator_parent' THEN 'pending'::account_status
    WHEN v_role = 'student'         THEN 'hold'::account_status
    ELSE 'approved'::account_status
  END;

  INSERT INTO public.users (id, email, full_name, whatsapp, grade, subjects, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(NEW.raw_user_meta_data->>'grade', ''),
    COALESCE(NEW.raw_user_meta_data->>'subjects', ''),
    v_role,
    v_status
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Backfill existing auth users that have no profile row ───────────────
-- WARNING: students backfilled here land in 'hold' and cannot use the student
-- area until an educator links them. Only run if these users really are
-- unlinked; otherwise approve them explicitly afterwards.
INSERT INTO public.users (id, email, full_name, whatsapp, grade, subjects, role, account_status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(u.raw_user_meta_data->>'whatsapp', ''),
  COALESCE(u.raw_user_meta_data->>'grade', ''),
  COALESCE(u.raw_user_meta_data->>'subjects', ''),
  COALESCE((u.raw_user_meta_data->>'role')::user_role, 'student'::user_role),
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'role', 'student') = 'educator_parent'
      THEN 'pending'::account_status
    WHEN COALESCE(u.raw_user_meta_data->>'role', 'student') = 'student'
      THEN 'hold'::account_status
    ELSE 'approved'::account_status
  END
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ── Verify ─────────────────────────────────────────────────────────────────
-- Expect the count to include every student, not just the educator:
--   SELECT role, count(*) FROM public.users GROUP BY role;
