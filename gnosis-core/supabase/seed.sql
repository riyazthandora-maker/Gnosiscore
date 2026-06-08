-- ============================================================
-- GnosisCore — Admin seed
-- Run AFTER schema.sql and AFTER adding the user in
-- Supabase → Authentication → Users → Add user
-- ============================================================

-- Promote riyazthandora@gmail.com to admin
UPDATE public.users
SET role = 'admin', account_status = 'approved'
WHERE email = 'riyazthandora@gmail.com';

-- Verify
SELECT id, email, role, account_status, created_at
FROM public.users
WHERE email = 'riyazthandora@gmail.com';
