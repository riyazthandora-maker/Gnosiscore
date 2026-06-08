-- ============================================================
-- GnosisCore — Full reset (old schema → new schema)
-- Drops everything in public schema, then recreates from scratch
-- ============================================================

-- Drop all tables (CASCADE handles FK dependencies)
DROP TABLE IF EXISTS public.dashboard_shares        CASCADE;
DROP TABLE IF EXISTS public.diagnostic_reports      CASCADE;
DROP TABLE IF EXISTS public.responses               CASCADE;
DROP TABLE IF EXISTS public.questions               CASCADE;
DROP TABLE IF EXISTS public.test_invitations        CASCADE;
DROP TABLE IF EXISTS public.test_attempts           CASCADE;
DROP TABLE IF EXISTS public.test_configs            CASCADE;
DROP TABLE IF EXISTS public.documents               CASCADE;
DROP TABLE IF EXISTS public.users                   CASCADE;

-- New tables that may exist from partial runs
DROP TABLE IF EXISTS public.notifications           CASCADE;
DROP TABLE IF EXISTS public.generation_requests     CASCADE;
DROP TABLE IF EXISTS public.document_chunks         CASCADE;
DROP TABLE IF EXISTS public.test_assignments        CASCADE;
DROP TABLE IF EXISTS public.educator_students       CASCADE;

-- Drop old trigger and function
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user()   CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()           CASCADE;
DROP FUNCTION IF EXISTS public.match_chunks(vector, uuid[], float, int) CASCADE;

-- Drop old ENUMs
DROP TYPE IF EXISTS user_role         CASCADE;
DROP TYPE IF EXISTS account_status    CASCADE;
DROP TYPE IF EXISTS generation_status CASCADE;
DROP TYPE IF EXISTS question_status   CASCADE;
