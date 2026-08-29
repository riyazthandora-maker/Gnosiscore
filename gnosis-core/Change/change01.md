# Change 01 — Implementation Plan

Each section below is a self-contained implementation unit. Tell Claude **"implement Section N"** to begin that phase. Complete sections in order — later sections depend on earlier ones. The below change will impact document upload page, test creation page, and test assigning page.  

---

## Section 1 — Chapter & Document Management

**Scope:** Database schema, backend API routes, and frontend UI for creating/deleting chapters and uploading documents against them.

### Rules
1. Chapter names must be unique per teacher/user ID.
2. Users can upload multiple documents per chapter via an "Upload More" button.
3. Default limits (all configurable by Admin per user):
   - Max size per document: **4 MB**
   - Max documents per chapter: **10**
   - Total storage per teacher: **200 MB**
   - Monthly upload count: **100 uploads/month**
4. Deleting a chapter cascades-deletes all its documents and frees storage immediately.
5. All list views are mobile-friendly with **max 15 items per page** before pagination.

### Deliverables
- [x] Supabase migration: `supabase/chapters.sql` — `chapters` table, `chapter_id` on `documents`, platform_settings columns, user override columns
- [x] Backend: `GET/POST /api/educator/chapters` — list (paginated) + create with unique-name check
- [x] Backend: `GET/DELETE /api/educator/chapters/[id]` — detail + cascade delete (storage + DB)
- [x] Backend: `POST /api/educator/chapters/[id]/documents/presign` — all 4 quota checks before issuing signed URL
- [x] Backend: `GET/POST /api/educator/chapters/[id]/documents` — list docs + register + pipeline
- [x] Backend: `DELETE /api/educator/chapters/[id]/documents/[docId]` — delete single doc + storage files
- [x] Backend: `GET/PATCH /api/admin/users/[id]/storage-limits` — per-user overrides
- [x] Frontend: `/chapters` — chapter list with storage bar, monthly upload counter, create form, pagination
- [x] Frontend: `/chapters/[id]` — chapter detail with upload zone, doc list with status badges, delete per doc, pagination
- [x] Nav: "Chapters" added between Dashboard and Documents
- [x] Admin: `StorageLimitsEditor` on registrations page (per-user overrides)
- [x] Admin: 3 new rows in Platform Settings (storage pool, max docs/chapter, monthly limit)

**Run before testing:** `supabase/chapters.sql` in Supabase Dashboard SQL Editor.

---

## Section 2 — Revamped Generate Test Page

**Scope:** Backend generation pipeline and frontend UI for the new streamlined test creation flow. Depends on Section 1 (chapters must exist).

### Rules
1. User provides a unique **Test Name**.
2. User selects one or more **Chapters** (from Section 1).
3. **Prompt & Source Blending:**
   - Text box for a custom generation prompt.
   - Percentage field for prompt-vs-document mix.
   - If no chapters selected → percentage locked at 100% prompt.
   - If chapters selected → default is 20% prompt / 80% documents; user can edit freely.
4. **Toughness Slider:** 0–100%. 0 = all easy, 100 = all hard; intermediate = ratio of hard questions.
5. **Question Count & Admin Approval:**
   - Numeric input, default **20**.
   - Requests above 20 enter a **"Pending Admin Approval"** state before generation proceeds.
   - The 20-question threshold is configurable by Admin per teacher account.
6. **Anti-hallucination:** Verify source context before generation; convert documents to lightweight Markdown to minimize token usage.

### Deliverables
- [x] Supabase migration: `supabase/generate.sql` — adds `chapter_ids`, `prompt_pct`, `toughness` to `generation_requests`; adds `question_approval_threshold` per-user override to `users`
- [x] Backend: `POST /api/educator/tests/generate` — validates chapters, resolves doc IDs, RAG anti-hallucination check, blended generation or pending_admin
- [x] Backend: `POST /api/educator/tests/generate/suggest-name` — AI name suggestion from chapter names + prompt
- [x] Backend: `PATCH /api/admin/users/[id]/question-threshold` — per-user threshold override
- [x] Quiz generator: `generateBlended()` — RAG doc questions + prompt questions merged; `toughnessToDifficulty()` mapping
- [x] Admin approve route updated to call `generateBlended` for chapter-based requests
- [x] Frontend: `/tests/generate` replaced — 6 controls (name, chapters, prompt, blend%, toughness slider, question count)
- [x] Frontend: Pending Approval banner with threshold display
- [x] Admin generation-requests page: shows chapter count, prompt%, toughness per request
- [x] Admin registrations: `QuestionThresholdEditor` per approved educator

**Run before testing:** `supabase/generate.sql` in Supabase Dashboard SQL Editor.

---

## Section 3 — Question Review & Editing Screen

**Scope:** Post-generation review UI and backend CRUD for editing the generated question set before publishing. Depends on Section 2 (test must have been generated).

### Rules
1. Shown immediately after generation completes (or after Admin approval if applicable).
2. Teachers can view all questions with options and correct answers.
3. **Inline editing:** question text, choices, correct answer, difficulty weight.
4. **Delete:** remove individual questions from the set.
5. **Finalize:** confirmation action locks the question set and marks the test as `published`/ready-to-assign.
6. UI must be fully mobile-responsive.

### Deliverables
- [ ] Supabase table: `test_questions` (id, test_id, question_text, options JSONB, correct_answer, difficulty_weight, sort_order)
- [ ] Backend: `GET /api/educator/tests/[id]/questions` — fetch all questions for a test
- [ ] Backend: `PATCH /api/educator/tests/[id]/questions/[qId]` — inline edit
- [ ] Backend: `DELETE /api/educator/tests/[id]/questions/[qId]` — delete question
- [ ] Backend: `POST /api/educator/tests/[id]/finalize` — lock test, set status = `published`
- [ ] Frontend: Review screen listing all questions with inline edit controls
- [ ] Frontend: Per-question delete button with confirmation
- [ ] Frontend: "Finalize Test" CTA button with confirmation dialog
- [ ] Mobile-first layout with readable card-per-question design

---

## Section 4 — Test Assigning Page

**Scope:** UI and backend for assigning a finalized test to students with scheduling, policies, and student-facing view restrictions. Depends on Section 3 (test must be published).

### Rules
1. **Test Selection:** Dropdown showing published tests; display test name + question count + toughness level.
2. **Time Allocation:** Minutes field, `0` = no limit, default = **20 minutes**.
3. **Timer Visibility:** If minutes > 0, toggle to show/hide the countdown timer to students.
4. **Answer Key Visibility:** Toggle — show answer key immediately after submission or hide it.
5. **Retake Policy:** Toggle — allow multiple retakes or single attempt only.
6. **Scheduling Windows:**
   - Start Date & Time: when the test becomes visible to students.
   - End Date & Time: when the test is removed from the student portal.
7. Mobile-first UI.

### Deliverables
- [ ] Supabase table: `test_assignments` (id, test_id, assigned_by, student_id or group_id, time_limit_minutes, show_timer, show_answer_key, allow_retake, starts_at, ends_at, created_at)
- [ ] Backend: `POST /api/educator/assignments` — create assignment with scheduling validation (end > start, start not in past)
- [ ] Backend: `GET /api/educator/assignments` — list assignments with status (upcoming / active / expired)
- [ ] Backend: `DELETE /api/educator/assignments/[id]` — cancel/remove assignment
- [ ] Student portal: filter visible tests by `starts_at <= now <= ends_at`
- [ ] Student portal: enforce single-attempt if `allow_retake = false`
- [ ] Student portal: hide/show timer based on `show_timer` flag
- [ ] Student portal: hide/show answer key after submission based on `show_answer_key` flag
- [ ] Frontend: Assignment creation form with all 7 controls
- [ ] Frontend: Assignment list with status badges (Upcoming / Active / Expired)
- [ ] Mobile-first layout

---

## Implementation Order

```
Section 1 → Section 2 → Section 3 → Section 4
```

Each section builds on the previous. SQL migrations should be run in Supabase Dashboard SQL Editor after each section before testing.
