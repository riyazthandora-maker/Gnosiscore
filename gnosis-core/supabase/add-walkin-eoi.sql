-- Walk-in student EOI flow
ALTER TABLE public.student_roster
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eoi_at TIMESTAMPTZ;

-- Talent insight report type discriminator
ALTER TABLE public.diagnostic_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'diagnostic',
  ADD COLUMN IF NOT EXISTS session_id UUID;
