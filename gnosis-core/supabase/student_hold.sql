-- ── STUDENT REGISTRATION FIELDS + HOLD STATE ───────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor → Run
--
-- WHY: Students self-register before any educator has added them to a class.
-- We now collect their contact number, grade and the subjects they want help
-- with at signup, and park them in a new 'hold' status until an educator links
-- them (via roster invite, invite link, or manual add). Without a link they
-- would land on an empty dashboard nobody at management knows about.
--
-- NOTE: run the ALTER TYPE statement on its own if your SQL client wraps the
-- whole script in a single transaction — Postgres forbids using a new enum
-- value in the same transaction that added it.

ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'hold';

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grade    TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subjects TEXT NOT NULL DEFAULT '';

-- Auto-create profile row; educators start pending, students start on hold
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

-- ── Verify ─────────────────────────────────────────────────────────────────
--   SELECT enum_range(NULL::account_status);   -- should include 'hold'
