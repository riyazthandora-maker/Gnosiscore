-- ============================================================
-- GnosisCore — Educator/Parent-Led Model Schema
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ENUMs (safe to re-run)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'educator_parent', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE generation_status AS ENUM ('pending_admin', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE question_status AS ENUM ('pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT UNIQUE NOT NULL,
  full_name      TEXT NOT NULL DEFAULT '',
  whatsapp       TEXT NOT NULL DEFAULT '',
  role           user_role NOT NULL DEFAULT 'student',
  account_status account_status NOT NULL DEFAULT 'approved',
  approved_by    UUID REFERENCES public.users(id),
  approved_at    TIMESTAMPTZ,
  token_cap      INTEGER,
  tokens_used    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS token_cap   INTEGER;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0;

-- Auto-create profile row; educator_parent accounts start as pending
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
    ELSE 'approved'::account_status
  END;

  INSERT INTO public.users (id, email, full_name, whatsapp, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
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

-- ── EDUCATOR → STUDENT LINKS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.educator_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(educator_id, student_id)
);

-- ── DOCUMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  markdown_path     TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processing','ready','failed')),
  chunk_count       INT,
  total_bytes       BIGINT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── DOCUMENT CHUNKS (RAG) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(768),
  token_count INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- IVFFlat index — run VACUUM ANALYZE after bulk inserts
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── GENERATION REQUESTS (>20 question admin gate) ────────────
CREATE TABLE IF NOT EXISTS public.generation_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by   UUID NOT NULL REFERENCES public.users(id),
  document_ids   UUID[] NOT NULL,
  prompt_context TEXT,
  name           TEXT NOT NULL DEFAULT '',
  question_count INT NOT NULL,
  config         JSONB NOT NULL DEFAULT '{}',
  status         generation_status NOT NULL DEFAULT 'pending_admin',
  reviewed_by    UUID REFERENCES public.users(id),
  reviewed_at    TIMESTAMPTZ,
  admin_note     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.generation_requests
  ADD COLUMN IF NOT EXISTS name        TEXT    NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS public.generation_requests
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0;

-- ── RPC: atomic token increment ──────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_educator_tokens(p_user_id UUID, p_delta INTEGER)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.users SET tokens_used = tokens_used + p_delta WHERE id = p_user_id;
$$;

-- ── QUESTION BANK ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generation_request_id UUID REFERENCES public.generation_requests(id),
  document_id           UUID REFERENCES public.documents(id),
  chunk_ids             UUID[] DEFAULT '{}',
  question_text         TEXT NOT NULL,
  options               JSONB NOT NULL,
  explanation           TEXT,
  difficulty            TEXT CHECK (difficulty IN ('easy','medium','hard')),
  topic_tags            TEXT[] DEFAULT '{}',
  status                question_status NOT NULL DEFAULT 'pending_review',
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
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
  created_at     TIMESTAMPTZ DEFAULT NOW()
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

-- ── TEST ATTEMPTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         UUID NOT NULL REFERENCES public.tests(id),
  student_id      UUID NOT NULL REFERENCES public.users(id),
  answers         JSONB NOT NULL DEFAULT '{}',
  score           NUMERIC(5,2),
  max_score       INT,
  config_snapshot JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ── NOTIFICATIONS (admin badge + educator alerts) ─────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    JSONB DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chunks_document      ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner      ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_owner      ON public.questions(owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_status     ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_tests_creator        ON public.tests(creator_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student  ON public.test_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student     ON public.test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread   ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gen_requests_status  ON public.generation_requests(status);
CREATE INDEX IF NOT EXISTS idx_edu_students_edu     ON public.educator_students(educator_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educator_students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;

-- Helper: current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- users: self read/write; admin reads all
DROP POLICY IF EXISTS "users_self"  ON public.users;
DROP POLICY IF EXISTS "users_admin" ON public.users;
CREATE POLICY "users_self"  ON public.users FOR ALL    USING (auth.uid() = id);
CREATE POLICY "users_admin" ON public.users FOR SELECT USING (public.is_admin());

-- educator_students: educator manages; student reads own
DROP POLICY IF EXISTS "edu_students_educator" ON public.educator_students;
DROP POLICY IF EXISTS "edu_students_student"  ON public.educator_students;
CREATE POLICY "edu_students_educator" ON public.educator_students
  FOR ALL    USING (auth.uid() = educator_id);
CREATE POLICY "edu_students_student"  ON public.educator_students
  FOR SELECT USING (auth.uid() = student_id);

-- documents: owner full access; linked students read ready docs; admin reads all
DROP POLICY IF EXISTS "documents_owner"          ON public.documents;
DROP POLICY IF EXISTS "documents_linked_student" ON public.documents;
DROP POLICY IF EXISTS "documents_admin"          ON public.documents;
CREATE POLICY "documents_owner" ON public.documents
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "documents_linked_student" ON public.documents
  FOR SELECT USING (
    processing_status = 'ready' AND
    EXISTS (
      SELECT 1 FROM public.educator_students es
      WHERE es.student_id = auth.uid() AND es.educator_id = owner_id
    )
  );
CREATE POLICY "documents_admin" ON public.documents FOR SELECT USING (public.is_admin());

-- document_chunks: same as parent document
DROP POLICY IF EXISTS "chunks_owner" ON public.document_chunks;
DROP POLICY IF EXISTS "chunks_admin" ON public.document_chunks;
CREATE POLICY "chunks_owner" ON public.document_chunks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.owner_id = auth.uid())
  );
CREATE POLICY "chunks_admin" ON public.document_chunks FOR SELECT USING (public.is_admin());

-- generation_requests: requester owns; admin manages all
DROP POLICY IF EXISTS "gen_req_owner" ON public.generation_requests;
DROP POLICY IF EXISTS "gen_req_admin" ON public.generation_requests;
CREATE POLICY "gen_req_owner" ON public.generation_requests
  FOR ALL USING (auth.uid() = requested_by);
CREATE POLICY "gen_req_admin" ON public.generation_requests
  FOR ALL USING (public.is_admin());

-- questions: owner manages; admin reads; students read approved questions on assigned tests
DROP POLICY IF EXISTS "questions_owner"   ON public.questions;
DROP POLICY IF EXISTS "questions_admin"   ON public.questions;
DROP POLICY IF EXISTS "questions_student" ON public.questions;
CREATE POLICY "questions_owner" ON public.questions
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "questions_admin" ON public.questions
  FOR SELECT USING (public.is_admin());
CREATE POLICY "questions_student" ON public.questions
  FOR SELECT USING (
    status = 'approved' AND
    questions.id = ANY(
      SELECT unnest(t.question_ids)
      FROM public.test_assignments ta
      JOIN public.tests t ON t.id = ta.test_id
      WHERE ta.student_id = auth.uid()
    )
  );

-- tests: creator manages; admin reads; assigned students read published tests
DROP POLICY IF EXISTS "tests_creator" ON public.tests;
DROP POLICY IF EXISTS "tests_admin"   ON public.tests;
DROP POLICY IF EXISTS "tests_student" ON public.tests;
CREATE POLICY "tests_creator" ON public.tests
  FOR ALL USING (auth.uid() = creator_id);
CREATE POLICY "tests_admin" ON public.tests
  FOR SELECT USING (public.is_admin());
CREATE POLICY "tests_student" ON public.tests
  FOR SELECT USING (
    is_published AND
    EXISTS (
      SELECT 1 FROM public.test_assignments ta
      WHERE ta.test_id = tests.id AND ta.student_id = auth.uid()
    )
  );

-- test_assignments: assigner manages; student reads own
DROP POLICY IF EXISTS "assignments_assigner" ON public.test_assignments;
DROP POLICY IF EXISTS "assignments_student"  ON public.test_assignments;
CREATE POLICY "assignments_assigner" ON public.test_assignments
  FOR ALL USING (auth.uid() = assigned_by);
CREATE POLICY "assignments_student" ON public.test_assignments
  FOR SELECT USING (auth.uid() = student_id);

-- test_attempts: student owns; their educator can read
DROP POLICY IF EXISTS "attempts_student"  ON public.test_attempts;
DROP POLICY IF EXISTS "attempts_educator" ON public.test_attempts;
CREATE POLICY "attempts_student" ON public.test_attempts
  FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "attempts_educator" ON public.test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.educator_students es
      JOIN public.test_assignments ta ON ta.student_id = es.student_id
      WHERE es.educator_id = auth.uid()
        AND ta.test_id = test_attempts.test_id
        AND ta.student_id = test_attempts.student_id
    )
  );

-- notifications: own only
DROP POLICY IF EXISTS "notifs_own" ON public.notifications;
CREATE POLICY "notifs_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- ── VECTOR SEARCH RPC ─────────────────────────────────────────
-- Used by quiz-generator.ts for RAG chunk retrieval.
-- Requires pgvector extension (already enabled above).
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding   vector(768),
  document_ids      uuid[],
  similarity_threshold float DEFAULT 0.72,
  match_count       int    DEFAULT 20
)
RETURNS TABLE(id uuid, document_id uuid, content text, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  WHERE dc.document_id = ANY(document_ids)
    AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
