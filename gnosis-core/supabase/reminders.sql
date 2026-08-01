-- Migration: add reminder tracking columns to test_assignments
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE test_assignments
  ADD COLUMN IF NOT EXISTS reminder_count       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Index to speed up the daily cron query
CREATE INDEX IF NOT EXISTS idx_assignments_pending_reminder
  ON test_assignments (last_reminder_sent_at, reminder_count)
  WHERE reminder_count < 3;
