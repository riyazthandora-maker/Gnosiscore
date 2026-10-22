-- ============================================================
-- GnosisCore — Combined Schema
-- Single file, safe to run on a fresh database.
-- All CREATE TABLE / CREATE POLICY / CREATE INDEX use IF NOT EXISTS.
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";


-- ── ENUMs ────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'educator_parent', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected', 'hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE account_status ADD VALUE IF NOT EXISTS 'hold';

DO $$ BEGIN CREATE TYPE generation_status AS ENUM ('pending_admin', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE question_status AS ENUM ('pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE book_collab_role AS ENUM ('editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE milestone_type AS ENUM ('teach', 'revise', 'assess');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── HELPER FUNCTIONS (referenced in RLS policies) ─────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_book_owner(p_book_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.books b WHERE b.id = p_book_id AND b.owner_id = auth.uid()
  );
$$;


-- ═══════════════════════════════════════════════════════════
-- TABLES (in dependency order)
-- ═══════════════════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT UNIQUE NOT NULL,
  full_name             TEXT NOT NULL DEFAULT '',
  whatsapp              TEXT NOT NULL DEFAULT '',
  grade                 TEXT NOT NULL DEFAULT '',
  subjects              TEXT NOT NULL DEFAULT '',
  role                  user_role NOT NULL DEFAULT 'student',
  account_status        account_status NOT NULL DEFAULT 'approved',
  approved_by           UUID REFERENCES public.users(id),
  approved_at           TIMESTAMPTZ,
  token_cap             INTEGER,
  tokens_used           INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  storage_limit_bytes   BIGINT,
  doc_size_limit_bytes  BIGINT,
  max_docs_per_chapter  INT,
  monthly_upload_limit  INT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
-- Idempotent column additions for older installs
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS token_cap             INTEGER;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS tokens_used           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS is_active             BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS grade                 TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS subjects              TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS storage_limit_bytes   BIGINT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS doc_size_limit_bytes  BIGINT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS max_docs_per_chapter  INT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS monthly_upload_limit  INT;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_self"  ON public.users;
DROP POLICY IF EXISTS "users_admin" ON public.users;
CREATE POLICY "users_self"  ON public.users FOR ALL    USING (auth.uid() = id);
CREATE POLICY "users_admin" ON public.users FOR SELECT USING (public.is_admin());

-- Trigger: auto-create profile row on auth sign-up
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
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(NEW.raw_user_meta_data->>'grade', ''),
    COALESCE(NEW.raw_user_meta_data->>'subjects', ''),
    v_role, v_status
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── PLATFORM SETTINGS (singleton) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                          INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  file_size_limit_bytes       BIGINT  NOT NULL DEFAULT 4194304,
  question_approval_threshold INT     NOT NULL DEFAULT 20,
  max_pause_duration_seconds  INT     NOT NULL DEFAULT 900,
  max_storage_bytes           BIGINT  NOT NULL DEFAULT 209715200,
  max_docs_per_chapter        INT     NOT NULL DEFAULT 10,
  monthly_upload_limit        INT     NOT NULL DEFAULT 100,
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE IF EXISTS public.platform_settings ADD COLUMN IF NOT EXISTS max_storage_bytes    BIGINT NOT NULL DEFAULT 209715200;
ALTER TABLE IF EXISTS public.platform_settings ADD COLUMN IF NOT EXISTS max_docs_per_chapter INT    NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS public.platform_settings ADD COLUMN IF NOT EXISTS monthly_upload_limit INT    NOT NULL DEFAULT 100;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_all"    ON public.platform_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.platform_settings;
CREATE POLICY "settings_read_all"    ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.platform_settings FOR UPDATE USING (public.is_admin());


-- ── EDUCATOR → STUDENT LINKS (legacy) ────────────────────────
CREATE TABLE IF NOT EXISTS public.educator_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(educator_id, student_id)
);
ALTER TABLE public.educator_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edu_students_educator" ON public.educator_students;
DROP POLICY IF EXISTS "edu_students_student"  ON public.educator_students;
CREATE POLICY "edu_students_educator" ON public.educator_students FOR ALL    USING (auth.uid() = educator_id);
CREATE POLICY "edu_students_student"  ON public.educator_students FOR SELECT USING (auth.uid() = student_id);


-- ── BOOKS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  blocks     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.book_collaborators (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id  UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role     book_collab_role NOT NULL DEFAULT 'viewer',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (book_id, user_id)
);

CREATE OR REPLACE FUNCTION public.touch_book_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS books_touch_updated_at ON public.books;
CREATE TRIGGER books_touch_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.touch_book_updated_at();

ALTER TABLE public.books              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "books_owner_all"      ON public.books;
DROP POLICY IF EXISTS "books_collab_select"  ON public.books;
DROP POLICY IF EXISTS "books_editor_update"  ON public.books;
CREATE POLICY "books_owner_all"     ON public.books FOR ALL    USING (owner_id = auth.uid());
CREATE POLICY "books_collab_select" ON public.books FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.book_collaborators bc WHERE bc.book_id = id AND bc.user_id = auth.uid())
);
CREATE POLICY "books_editor_update" ON public.books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.book_collaborators bc WHERE bc.book_id = id AND bc.user_id = auth.uid() AND bc.role = 'editor')
);
DROP POLICY IF EXISTS "book_collabs_owner_all" ON public.book_collaborators;
DROP POLICY IF EXISTS "book_collabs_self_read" ON public.book_collaborators;
CREATE POLICY "book_collabs_owner_all" ON public.book_collaborators FOR ALL    USING (public.is_book_owner(book_id));
CREATE POLICY "book_collabs_self_read" ON public.book_collaborators FOR SELECT USING (user_id = auth.uid());


-- ── CHAPTERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chapters_owner" ON public.chapters;
DROP POLICY IF EXISTS "chapters_admin" ON public.chapters;
CREATE POLICY "chapters_owner" ON public.chapters FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "chapters_admin" ON public.chapters FOR SELECT USING (public.is_admin());


-- ── STUDENT GRADES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_grades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, name)
);
ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "educators_manage_own_grades" ON public.student_grades;
CREATE POLICY "educators_manage_own_grades" ON public.student_grades FOR ALL USING (teacher_id = auth.uid());


-- ── STUDENT ROSTER ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_roster (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  grade_id          UUID REFERENCES public.student_grades(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'active', 'archived')),
  invite_token      TEXT UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  is_walkin         BOOLEAN NOT NULL DEFAULT FALSE,
  eoi_at            TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, email)
);
ALTER TABLE IF EXISTS public.student_roster ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS public.student_roster ADD COLUMN IF NOT EXISTS eoi_at    TIMESTAMPTZ;
ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "educators_manage_own_roster" ON public.student_roster;
DROP POLICY IF EXISTS "students_read_own_roster"    ON public.student_roster;
CREATE POLICY "educators_manage_own_roster" ON public.student_roster FOR ALL    USING (teacher_id = auth.uid());
CREATE POLICY "students_read_own_roster"    ON public.student_roster FOR SELECT USING (student_user_id = auth.uid());


-- ── GENERATION REQUESTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generation_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by   UUID NOT NULL REFERENCES public.users(id),
  document_ids   UUID[] NOT NULL,
  prompt_context TEXT,
  name           TEXT NOT NULL DEFAULT '',
  question_count INT NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}',
  tokens_used    INTEGER NOT NULL DEFAULT 0,
  status         generation_status NOT NULL DEFAULT 'pending_admin',
  reviewed_by    UUID REFERENCES public.users(id),
  reviewed_at    TIMESTAMPTZ,
  admin_note     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.generation_requests ADD COLUMN IF NOT EXISTS name        TEXT    NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS public.generation_requests ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gen_req_owner" ON public.generation_requests;
DROP POLICY IF EXISTS "gen_req_admin" ON public.generation_requests;
CREATE POLICY "gen_req_owner" ON public.generation_requests FOR ALL USING (auth.uid() = requested_by);
CREATE POLICY "gen_req_admin" ON public.generation_requests FOR ALL USING (public.is_admin());


-- ── QUESTION BANK ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generation_request_id UUID REFERENCES public.generation_requests(id),
  question_text         TEXT NOT NULL,
  options               JSONB NOT NULL,
  explanation           TEXT,
  difficulty            TEXT CHECK (difficulty IN ('easy','medium','hard')),
  topic_tags            TEXT[] DEFAULT '{}',
  status                question_status NOT NULL DEFAULT 'pending_review',
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_owner"   ON public.questions;
DROP POLICY IF EXISTS "questions_admin"   ON public.questions;
DROP POLICY IF EXISTS "questions_student" ON public.questions;
CREATE POLICY "questions_owner" ON public.questions FOR ALL    USING (auth.uid() = owner_id);
CREATE POLICY "questions_admin" ON public.questions FOR SELECT USING (public.is_admin());
CREATE POLICY "questions_student" ON public.questions FOR SELECT USING (
  status = 'approved' AND
  questions.id = ANY(
    SELECT unnest(t.question_ids)
    FROM public.test_assignments ta
    JOIN public.tests t ON t.id = ta.test_id
    WHERE ta.student_id = auth.uid()
  )
);


-- ── TESTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  question_ids   UUID[] NOT NULL DEFAULT '{}',
  time_limit_min INT,
  is_published   BOOLEAN NOT NULL DEFAULT false,
  allow_pause    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.tests ADD COLUMN IF NOT EXISTS allow_pause BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tests_creator" ON public.tests;
DROP POLICY IF EXISTS "tests_admin"   ON public.tests;
DROP POLICY IF EXISTS "tests_student" ON public.tests;
CREATE POLICY "tests_creator" ON public.tests FOR ALL    USING (auth.uid() = creator_id);
CREATE POLICY "tests_admin"   ON public.tests FOR SELECT USING (public.is_admin());
CREATE POLICY "tests_student" ON public.tests FOR SELECT USING (
  is_published AND EXISTS (
    SELECT 1 FROM public.test_assignments ta
    WHERE ta.test_id = tests.id AND ta.student_id = auth.uid()
  )
);


-- ── TEST ASSIGNMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.test_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id     UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.users(id),
  due_at      TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_id, student_id)
);
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments_assigner" ON public.test_assignments;
DROP POLICY IF EXISTS "assignments_student"  ON public.test_assignments;
CREATE POLICY "assignments_assigner" ON public.test_assignments FOR ALL    USING (auth.uid() = assigned_by);
CREATE POLICY "assignments_student"  ON public.test_assignments FOR SELECT USING (auth.uid() = student_id);


-- ── TEST ATTEMPTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id               UUID NOT NULL REFERENCES public.tests(id),
  student_id            UUID NOT NULL REFERENCES public.users(id),
  answers               JSONB NOT NULL DEFAULT '{}',
  score                 NUMERIC(5,2),
  max_score             INT,
  config_snapshot       JSONB NOT NULL DEFAULT '{}',
  attempt_number        INT NOT NULL DEFAULT 1,
  is_first_attempt      BOOLEAN NOT NULL DEFAULT true,
  paused_at             TIMESTAMPTZ,
  total_paused_seconds  INT NOT NULL DEFAULT 0,
  last_heartbeat_at     TIMESTAMPTZ DEFAULT NOW(),
  question_order        JSONB DEFAULT '[]',
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS attempt_number        INT         NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS is_first_attempt      BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS paused_at             TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS total_paused_seconds  INT         NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS last_heartbeat_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.test_attempts ADD COLUMN IF NOT EXISTS question_order        JSONB       DEFAULT '[]';
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempts_student"  ON public.test_attempts;
DROP POLICY IF EXISTS "attempts_educator" ON public.test_attempts;
CREATE POLICY "attempts_student"  ON public.test_attempts FOR ALL    USING (auth.uid() = student_id);
CREATE POLICY "attempts_educator" ON public.test_attempts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.educator_students es
    JOIN public.test_assignments ta ON ta.student_id = es.student_id
    WHERE es.educator_id = auth.uid()
      AND ta.test_id = test_attempts.test_id
      AND ta.student_id = test_attempts.student_id
  )
);


-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    JSONB DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs_own" ON public.notifications;
CREATE POLICY "notifs_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);


-- ── EXAM PAPERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_papers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  questions   JSONB       NOT NULL DEFAULT '[]',
  source_meta JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_papers_owner" ON public.exam_papers;
CREATE POLICY "exam_papers_owner" ON public.exam_papers
  USING  (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());


-- ── EXAM ASSIGNMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_assignments (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id                    UUID    NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  student_roster_id           UUID    NOT NULL REFERENCES public.student_roster(id) ON DELETE CASCADE,
  assigned_by                 UUID    NOT NULL,
  assigned_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes            INTEGER NOT NULL DEFAULT 20,
  starts_at                   TIMESTAMPTZ,
  ends_at                     TIMESTAMPTZ,
  max_attempts                INTEGER NOT NULL DEFAULT 3,
  randomize_questions         BOOLEAN NOT NULL DEFAULT false,
  shuffle_answers             BOOLEAN NOT NULL DEFAULT false,
  allow_backtrack             BOOLEAN NOT NULL DEFAULT true,
  mandatory_answering         BOOLEAN NOT NULL DEFAULT false,
  flag_for_review             BOOLEAN NOT NULL DEFAULT true,
  browser_lockdown            BOOLEAN NOT NULL DEFAULT false,
  disable_copy_paste          BOOLEAN NOT NULL DEFAULT false,
  tab_switch_warnings         BOOLEAN NOT NULL DEFAULT false,
  tab_switch_limit            INTEGER NOT NULL DEFAULT 3,
  release_results_immediately BOOLEAN NOT NULL DEFAULT true,
  show_explanations           BOOLEAN NOT NULL DEFAULT true,
  threshold_excellent         INTEGER NOT NULL DEFAULT 90,
  threshold_distinction       INTEGER NOT NULL DEFAULT 80,
  threshold_pass              INTEGER NOT NULL DEFAULT 70,
  UNIQUE(paper_id, student_roster_id)
);
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ea_educator_all" ON public.exam_assignments;
DROP POLICY IF EXISTS "ea_student_read" ON public.exam_assignments;
CREATE POLICY "ea_educator_all" ON public.exam_assignments FOR ALL    USING (assigned_by = auth.uid());
CREATE POLICY "ea_student_read" ON public.exam_assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.student_roster sr
    WHERE sr.id = exam_assignments.student_roster_id
      AND sr.student_user_id = auth.uid()
  )
);


-- ── EXAM SESSIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id     UUID    NOT NULL REFERENCES public.exam_assignments(id) ON DELETE CASCADE,
  student_user_id   UUID    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'lobby'
                      CHECK (status IN ('lobby','in_progress','paused','submitted','auto_submitted')),
  attempt_number    INTEGER NOT NULL DEFAULT 1,
  started_at        TIMESTAMPTZ,
  paused_at         TIMESTAMPTZ,
  elapsed_seconds   INTEGER NOT NULL DEFAULT 0,
  answers           JSONB   NOT NULL DEFAULT '{}',
  flagged_questions TEXT[]  NOT NULL DEFAULT '{}',
  tab_switch_count  INTEGER NOT NULL DEFAULT 0,
  score             NUMERIC(5,2),
  max_score         INTEGER,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "es_student_all"    ON public.exam_sessions;
DROP POLICY IF EXISTS "es_educator_read"  ON public.exam_sessions;
CREATE POLICY "es_student_all"   ON public.exam_sessions FOR ALL    USING (student_user_id = auth.uid());
CREATE POLICY "es_educator_read" ON public.exam_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.exam_assignments a
    WHERE a.id = exam_sessions.assignment_id AND a.assigned_by = auth.uid()
  )
);


-- ── PACING PLANS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacing_plans (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id            UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id               UUID    NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  grade_id              UUID    NOT NULL REFERENCES public.student_grades(id) ON DELETE CASCADE,
  title                 TEXT    NOT NULL,
  academic_year         TEXT    NOT NULL,
  start_month           INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  auto_assess_enabled   BOOLEAN NOT NULL DEFAULT false,
  difficulty_bands      JSONB   NOT NULL DEFAULT '{"low":[60,70],"medium":[70,80],"high":[80,100]}',
  auto_question_count   INTEGER NOT NULL DEFAULT 5,
  auto_duration_minutes INTEGER NOT NULL DEFAULT 10,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.pacing_plans ADD COLUMN IF NOT EXISTS auto_assess_enabled   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS public.pacing_plans ADD COLUMN IF NOT EXISTS difficulty_bands      JSONB   NOT NULL DEFAULT '{"low":[60,70],"medium":[70,80],"high":[80,100]}';
ALTER TABLE IF EXISTS public.pacing_plans ADD COLUMN IF NOT EXISTS auto_question_count   INTEGER NOT NULL DEFAULT 5;
ALTER TABLE IF EXISTS public.pacing_plans ADD COLUMN IF NOT EXISTS auto_duration_minutes INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.pacing_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_plans' AND policyname = 'teachers_manage_own_plans') THEN
    CREATE POLICY "teachers_manage_own_plans" ON public.pacing_plans FOR ALL USING (teacher_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_plans' AND policyname = 'students_read_plans_for_grade') THEN
    CREATE POLICY "students_read_plans_for_grade" ON public.pacing_plans FOR SELECT USING (
      grade_id IN (
        SELECT grade_id FROM public.student_roster
        WHERE student_user_id = auth.uid() AND grade_id IS NOT NULL
      )
    );
  END IF;
END $$;


-- ── PACING MILESTONES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacing_milestones (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID    NOT NULL REFERENCES public.pacing_plans(id) ON DELETE CASCADE,
  node_id             TEXT    NOT NULL,
  node_level          TEXT    NOT NULL CHECK (node_level IN ('chapter','section','details')),
  node_title          TEXT    NOT NULL,
  scheduled_date      DATE,
  topic_notes         TEXT,
  milestone_type      milestone_type NOT NULL DEFAULT 'teach',
  auto_exam_paper_id  UUID REFERENCES public.exam_papers(id) ON DELETE SET NULL,
  auto_exam_status    TEXT CHECK (auto_exam_status IN ('pending_review', 'approved', 'assigned')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, node_id)
);
-- Migrate existing tables: replace month+week_in_month with scheduled_date
ALTER TABLE IF EXISTS public.pacing_milestones ADD COLUMN IF NOT EXISTS scheduled_date     DATE;
ALTER TABLE IF EXISTS public.pacing_milestones DROP COLUMN IF EXISTS month;
ALTER TABLE IF EXISTS public.pacing_milestones DROP COLUMN IF EXISTS week_in_month;
ALTER TABLE IF EXISTS public.pacing_milestones ADD COLUMN IF NOT EXISTS milestone_type     milestone_type NOT NULL DEFAULT 'teach';
ALTER TABLE IF EXISTS public.pacing_milestones ADD COLUMN IF NOT EXISTS auto_exam_paper_id UUID REFERENCES public.exam_papers(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.pacing_milestones ADD COLUMN IF NOT EXISTS auto_exam_status   TEXT CHECK (auto_exam_status IN ('pending_review', 'approved', 'assigned'));
ALTER TABLE public.pacing_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_milestones' AND policyname = 'teachers_manage_own_milestones') THEN
    CREATE POLICY "teachers_manage_own_milestones" ON public.pacing_milestones FOR ALL USING (
      plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
    );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_milestones' AND policyname = 'students_read_milestones') THEN
    CREATE POLICY "students_read_milestones" ON public.pacing_milestones FOR SELECT USING (
      plan_id IN (
        SELECT id FROM public.pacing_plans WHERE grade_id IN (
          SELECT grade_id FROM public.student_roster
          WHERE student_user_id = auth.uid() AND grade_id IS NOT NULL
        )
      )
    );
  END IF;
END $$;


-- ── PACING EVENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pacing_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID NOT NULL REFERENCES public.pacing_plans(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
                 'auto_exam_generated','auto_exam_approved','auto_exam_assigned',
                 'reschedule_suggested','reschedule_applied',
                 'remediation_suggested','remediation_applied'
               )),
  payload      JSONB NOT NULL DEFAULT '{}',
  triggered_by TEXT NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pacing_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_events' AND policyname = 'events_plan_owner') THEN
    CREATE POLICY "events_plan_owner" ON public.pacing_events FOR ALL USING (
      plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
    );
  END IF;
END $$;


-- ── PACING SUGGESTIONS ────────────────────────────────────────
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pacing_suggestions' AND policyname = 'suggestions_plan_owner') THEN
    CREATE POLICY "suggestions_plan_owner" ON public.pacing_suggestions FOR ALL USING (
      plan_id IN (SELECT id FROM public.pacing_plans WHERE teacher_id = auth.uid())
    );
  END IF;
END $$;


-- ── DIAGNOSTIC REPORTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  strengths     JSONB,
  weaknesses    JSONB,
  raw_narrative TEXT,
  report_type   TEXT NOT NULL DEFAULT 'diagnostic',
  session_id    UUID
);
ALTER TABLE IF EXISTS public.diagnostic_reports ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'diagnostic';
ALTER TABLE IF EXISTS public.diagnostic_reports ADD COLUMN IF NOT EXISTS session_id  UUID;
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diagnostic_reports' AND policyname = 'Users can manage their own reports') THEN
    EXECUTE $pol$
      CREATE POLICY "Users can manage their own reports"
        ON public.diagnostic_reports FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $pol$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_questions_owner          ON public.questions(owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_status         ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_tests_creator            ON public.tests(creator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student      ON public.test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student         ON public.test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_incomplete      ON public.test_attempts(last_heartbeat_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_first           ON public.test_attempts(test_id, student_id) WHERE is_first_attempt = true;
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread       ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gen_requests_status      ON public.generation_requests(status);
CREATE INDEX IF NOT EXISTS idx_edu_students_edu         ON public.educator_students(educator_id);
CREATE INDEX IF NOT EXISTS idx_chapters_user            ON public.chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_papers_teacher      ON public.exam_papers(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_roster_invite_token ON public.student_roster(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_roster_email     ON public.student_roster(email);
CREATE INDEX IF NOT EXISTS idx_pacing_milestones_plan_id ON public.pacing_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_pacing_events_plan       ON public.pacing_events(plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pacing_suggestions_plan  ON public.pacing_suggestions(plan_id, status);


-- ═══════════════════════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.increment_educator_tokens(p_user_id UUID, p_delta INTEGER)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.users SET tokens_used = tokens_used + p_delta WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.reset_all_educator_tokens()
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.users SET tokens_used = 0 WHERE role = 'educator_parent';
$$;

DROP FUNCTION IF EXISTS public.get_pending_auto_assess_milestones(integer);
CREATE OR REPLACE FUNCTION public.get_pending_auto_assess_milestones(
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
  milestone_id   UUID,
  plan_id        UUID,
  node_id        TEXT,
  node_title     TEXT,
  scheduled_date DATE
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


-- ═══════════════════════════════════════════════════════════
-- GRANTS (required from 2026-10-30 — no more auto-grants)
-- ═══════════════════════════════════════════════════════════
GRANT SELECT ON public.users                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users                TO service_role;

GRANT SELECT ON public.platform_settings    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings    TO service_role;

GRANT SELECT ON public.educator_students    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educator_students    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educator_students    TO service_role;

GRANT SELECT ON public.books                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books                TO service_role;

GRANT SELECT ON public.book_collaborators   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_collaborators   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_collaborators   TO service_role;

GRANT SELECT ON public.chapters             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters             TO service_role;

GRANT SELECT ON public.student_grades       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_grades       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_grades       TO service_role;

GRANT SELECT ON public.student_roster       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_roster       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_roster       TO service_role;

GRANT SELECT ON public.generation_requests  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_requests  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_requests  TO service_role;

GRANT SELECT ON public.questions            TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions            TO service_role;

GRANT SELECT ON public.tests                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests                TO service_role;

GRANT SELECT ON public.test_assignments     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_assignments     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_assignments     TO service_role;

GRANT SELECT ON public.test_attempts        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts        TO service_role;

GRANT SELECT ON public.notifications        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications        TO service_role;

GRANT SELECT ON public.exam_papers          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_papers          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_papers          TO service_role;

GRANT SELECT ON public.exam_assignments     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_assignments     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_assignments     TO service_role;

GRANT SELECT ON public.exam_sessions        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sessions        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sessions        TO service_role;

GRANT SELECT ON public.pacing_plans         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_plans         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_plans         TO service_role;

GRANT SELECT ON public.pacing_milestones    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_milestones    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_milestones    TO service_role;

GRANT SELECT ON public.pacing_events        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_events        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_events        TO service_role;

GRANT SELECT ON public.pacing_suggestions   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_suggestions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacing_suggestions   TO service_role;

GRANT SELECT ON public.diagnostic_reports   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_reports   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_reports   TO service_role;
