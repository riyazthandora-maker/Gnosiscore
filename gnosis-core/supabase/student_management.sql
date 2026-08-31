-- ============================================================
-- Student Management Module — Migration
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── STUDENT GRADES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_grades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, name)
);

ALTER TABLE public.student_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "educators_manage_own_grades" ON public.student_grades
  FOR ALL USING (teacher_id = auth.uid());

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
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, email)
);

ALTER TABLE public.student_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "educators_manage_own_roster" ON public.student_roster
  FOR ALL USING (teacher_id = auth.uid());

-- Students can read their own roster entry (needed for exam_assignments dashboard query)
CREATE POLICY "students_read_own_roster" ON public.student_roster
  FOR SELECT USING (student_user_id = auth.uid());

-- Index for fast token lookups (used by public invite route via admin client)
CREATE INDEX IF NOT EXISTS idx_student_roster_invite_token
  ON public.student_roster(invite_token)
  WHERE invite_token IS NOT NULL;

-- Index for fast email lookups during auto-link on registration
CREATE INDEX IF NOT EXISTS idx_student_roster_email
  ON public.student_roster(email);
