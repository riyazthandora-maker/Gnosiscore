# Pacing & Scheduling Module

## Overview

Two-phase module for curriculum planning:
- **Phase 1 (Implemented)** — Pacing: teachers map book chapters to Week/Month slots across a full academic year.
- **Phase 2 (Not started)** — Scheduling Engine: adaptive difficulty, remediation triggers, cohort analytics.

---

## Phase 1 — Implemented

### Data Model

**`pacing_plans`** table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `teacher_id` | UUID FK → users | |
| `book_id` | UUID FK → books | |
| `grade_id` | UUID FK → student_grades | |
| `title` | TEXT | e.g. "Physics — Grade 9 — 2026-2027" |
| `academic_year` | TEXT | e.g. "2026-2027" |
| `start_month` | INTEGER 1–12 | Month the academic year begins |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

RLS: teachers manage own plans; students can read plans for their grade.

**`pacing_milestones`** table
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID FK → pacing_plans CASCADE | |
| `month` | INTEGER 1–12 | Calendar month number |
| `week_in_month` | INTEGER 1–4 | Week slot within the month |
| `chapter_node_id` | TEXT | References `books.blocks[].id` where level = "chapter" |
| `section_node_id` | TEXT NULL | Optional section within the chapter |
| `chapter_title` | TEXT | Denormalized for display |
| `topic_notes` | TEXT NULL | Optional teacher notes |
| `created_at` | TIMESTAMPTZ | |

Unique constraint: `(plan_id, month, week_in_month)` — one chapter per week slot.

SQL file: `supabase/pacing.sql` (must be run in Supabase dashboard).

---

### API Routes (all under `/api/educator/pacing/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/educator/pacing` | List teacher's pacing plans |
| POST | `/api/educator/pacing` | Create new plan |
| GET | `/api/educator/pacing/[planId]` | Get plan detail (with blocks + milestones) |
| PATCH | `/api/educator/pacing/[planId]` | Update plan title / year / start_month |
| DELETE | `/api/educator/pacing/[planId]` | Delete plan + cascade milestones |
| POST | `/api/educator/pacing/[planId]/milestones` | Upsert one or many milestones |
| DELETE | `/api/educator/pacing/[planId]/milestones/[id]` | Remove one milestone |
| POST | `/api/educator/pacing/[planId]/auto-pace` | AI auto-distributes chapters across year |
| POST | `/api/educator/pacing/[planId]/nlp` | Parse natural language → preview milestones |

Student API: `GET /api/student/pacing` — reads plans for the student's grade.

---

### Pages

**Educator (under `(dashboard)` route group):**
- `/exams/pacing` — Plan list page with progress cards (milestone_count/48 progress bar)
- `/exams/pacing/new` — Create plan form (book select, grade select, academic year, start month, title)
- `/exams/pacing/[planId]` — Interactive plan detail:
  - 12 month cards in a grid (ordered from `start_month`)
  - Each card shows 4 week slots (W1–W4)
  - Assigned slot: shows chapter title + delete (×) button
  - Empty slot: shows ChapterPicker dropdown
  - NLP input at top (parse instruction → preview chips → Apply/Cancel)
  - Auto-Pace button (Gemini AI distributes all chapters across year; replaces existing milestones)
  - Delete plan button at bottom (with confirmation)

**Student (under `(student)` route group):**
- `/student/pacing` — Read-only schedule view:
  - Shows only months that have at least one assigned chapter
  - Each slot has status badge: Past (strikethrough + ✓), This Week (highlighted), Upcoming
  - Status calculated from calendar date vs slot's calendar week

**Navigation additions:**
- Exams page header: "Pacing" button → `/exams/pacing`
- Student layout header: "My Schedule" link → `/student/pacing`
- Student dashboard: "My Schedule" button → `/student/pacing`

---

### Components

| File | Purpose |
|---|---|
| `src/components/pacing/create-plan-form.tsx` | `"use client"` form for new plan creation |
| `src/components/pacing/chapter-picker.tsx` | `<select>` filtered to `level === "chapter"` blocks; resets after selection |
| `src/components/pacing/nlp-input.tsx` | NLP text input → preview → apply/cancel flow |
| `src/components/pacing/plan-detail-client.tsx` | Main interactive year grid; manages milestone state locally |

---

### AI Features (Phase 1)

**Auto-Pace** (`/api/educator/pacing/[planId]/auto-pace`)
- Extracts chapters from `books.blocks` and estimates cognitive load via character count
- Sends chapter list to Gemini with a prompt to distribute across 12 months × 4 weeks
- Falls back to sequential even distribution if AI fails
- Deletes all existing milestones and replaces with AI output
- Returns `{ milestones, count }`

**NLP Scheduling** (`/api/educator/pacing/[planId]/nlp`)
- Takes a free-text instruction (e.g. "Assign Chapters 1–3 to March as weekly sprints")
- Sends chapter list + instruction to Gemini
- Returns `{ milestones, preview: true }` — does NOT apply; teacher confirms in UI
- Client shows preview chips; Apply bulk-POSTs to milestones endpoint

---

## Phase 2 — Not Started

### Planned features:
- **Milestone types** — Teach / Revise / Assessment week slots
- **Adaptive difficulty** — System default bands (Low: 60–70%, Medium: 70–80%, High: 80%+); teacher-editable per plan
- **Auto Assess** — Auto-generate an exam when a chapter milestone completes
- **Smart Rescheduling** — AI suggests moving unfinished milestones forward
- **Remediation triggers** — Detect low scores and suggest review weeks
- **Cohort analytics** — Class-wide pacing vs actual progress dashboard

Phase 2 depends on the Scheduling Engine (not yet planned) and the Assign Test module results.

---

## Key Decisions & Constraints

- **Slot system**: `month` (1–12 calendar) + `week_in_month` (1–4). One chapter per slot (enforced by UNIQUE constraint). Upsert on conflict allows reassignment.
- **Academic year wrapping**: Months ≥ `start_month` use year 1 of `academic_year`; months < `start_month` use year 2. Example: start_month=9, month=1 → uses 2027 in "2026-2027".
- **Ordered months** computed as: `Array.from({ length: 12 }, (_, i) => ((start_month - 1 + i) % 12) + 1)`
- **Chapter references**: `chapter_node_id` is a denormalized text ID from `books.blocks[].id` where `level === "chapter"`. Not a FK — books table stores blocks as JSONB.
- **48 slots total**: 12 months × 4 weeks. Not all need to be filled. Progress shown as `milestone_count/48`.
- **Supabase join types**: Supabase TypeScript types return joins as arrays even for many-to-one. Casts use `as unknown as { ... }` pattern throughout.
