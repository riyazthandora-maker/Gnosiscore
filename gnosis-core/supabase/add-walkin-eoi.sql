-- Walk-in student EOI flow
ALTER TABLE public.student_roster
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eoi_at TIMESTAMPTZ;

-- Create diagnostic_reports if it doesn't exist yet, then ensure talent columns
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

-- If the table already existed, add the new columns idempotently
ALTER TABLE public.diagnostic_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'diagnostic',
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- Explicit grants required for new tables after 2026-10-30 (Supabase auto-grant removal)
GRANT SELECT ON public.diagnostic_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_reports TO service_role;

-- RLS
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'diagnostic_reports' AND policyname = 'Users can manage their own reports'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can manage their own reports"
        ON public.diagnostic_reports
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $pol$;
  END IF;
END $$;
