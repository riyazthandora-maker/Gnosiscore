# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> **AGENTS.md warning applies here:** This project uses **Next.js 16.2.6**, which has breaking changes from older versions. Read `node_modules/next/dist/docs/` for current APIs before writing any Next.js code.

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Vitest in watch mode

# Run a single test file
npx vitest run src/lib/exam/utils.test.ts
```

Tests use Vitest with `environment: "node"` — no jsdom, no browser globals. Test files live alongside source at `src/**/*.test.ts`.

---

## Architecture

### Route Groups & Auth Guards

`src/app/` uses Next.js App Router with three protected route groups:

| Group | Path prefix | Guard |
|---|---|---|
| `(dashboard)` | `/dashboard`, `/books`, `/exams`, `/documents`, `/analytics`, `/settings` | Authenticated + educator approved |
| `(admin)` | `/admin/*` | `role === 'admin'` |
| `(student)` | `/student/*` | `role === 'student'` |

Guards live in each group's `layout.tsx` using `supabase.auth.getUser()` server-side. Unauthenticated users are redirected to `/login`; educators with `account_status: 'pending'` go to `/pending-approval`.

### Supabase Client Pattern

Three separate clients — always pick the right one:

- `src/lib/supabase/client.ts` — Browser (client components, event handlers)
- `src/lib/supabase/server.ts` — Server (RSCs, API routes, layouts) — uses cookies
- `src/lib/supabase/admin.ts` — Service role, bypasses RLS — only for admin API routes and cron jobs

### AI Question Generation Pipeline

The full path for exam question generation:

```
Exam Wizard (Step 4)
  → POST /api/educator/exams/generate
      → collectNodeSlices()       # extract text per selected node from book.blocks
      → normalizeWeights()        # re-scale weightages to sum 100%
      → distributeQuestions()     # allocate question counts by weight + easy_pct
      → generateQuestionsFromPrompt() × N  (parallel, one per task)
          → callGemini() with JSON schema system prompt
          → withRetry() (exponential backoff on 429)
          → parseQuestions() (3-attempt JSON parse with LaTeX fixup)
      → aggregate + assign UUIDs → return
```

Key files:
- `src/lib/ai/gemini.ts` — Raw HTTP wrapper for Gemini (not the SDK's `response.json()`; uses custom text sanitization to handle control chars in math output)
- `src/lib/ai/quiz-generator.ts` — `generateQuestionsFromPrompt()` (used by exam wizard) and `generateQuestions()` (legacy, chunk-based)
- `src/lib/exam/utils.ts` — Pure utility functions for the pipeline (fully unit-tested)

**LaTeX in JSON is a known pain point.** The AI outputs `$x^2$` style math inside JSON strings, where backslashes must be doubled. `fixLatexBackslashes()` in `quiz-generator.ts` handles unescaped backslashes from the model. When editing the system prompt, preserve the doubling rule: `\\\\leq` not `\\leq`.

### Exam Wizard State

6-step wizard at `/exams/new`. All cross-step state lives in `WizardContext` (`src/components/exams/wizard-context.tsx`):

```ts
{ step, books, selectedNodeIds, weightages, settings, questions, title }
```

Steps 1→2→3 build the generation payload. Step 4 fires the API and stores results. Steps 5→6 are preview and save. State persists across forward/back navigation within the session.

### Book Data Model

Books store content as a flat `blocks: FlatBlock[]` array on the `books` table:

```ts
interface FlatBlock {
  id: string
  level: "chapter" | "section" | "details"
  text: string
}
```

`parseTree()` in `step1-content-picker.tsx` reconstructs the chapter→section hierarchy from this flat list. `collectNodeSlices()` in `src/lib/exam/utils.ts` extracts text for AI generation by walking the same structure.

### KaTeX Rendering

`renderMixed(text, katex)` in `src/lib/exam/katex-utils.ts` is the single entry point for rendering math. It handles both `$$...$$` (display) and `$...$` (inline), falls back to escaped HTML on KaTeX errors, and is a pure function with no DOM dependency. Pass the `katex` import as an argument rather than importing directly — this keeps the function testable in Node.

### Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
SUPABASE_SERVICE_ROLE_KEY   # server-only, bypasses RLS
GOOGLE_AI_API_KEY            # Gemini 2.5 Flash
RESEND_API_KEY               # transactional email
```

Optional: `ANTHROPIC_API_KEY` (legacy), `STRIPE_SECRET_KEY`, `TWILIO_*`.
