-- Section 3: Question Review & Editing
-- Add difficulty_weight to questions table for per-question weighting in finalized tests
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty_weight NUMERIC(4,2) DEFAULT 1.0;
