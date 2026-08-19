import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestionsFromPrompt } from "@/lib/ai/quiz-generator"
import { getPlatformSettings } from "@/lib/platform-settings"
import type { Difficulty } from "@/types"
import type { FlatBlock } from "@/types/book"

interface Body {
  name: string
  scope: "full" | "chapter"
  chapterIndex?: number
  difficulty: Difficulty
  questionCount: number
}

function extractText(blocks: FlatBlock[], scope: "full" | "chapter", chapterIndex: number): string {
  let selected: FlatBlock[]

  if (scope === "chapter") {
    const starts = blocks
      .map((b, i) => (b.level === "chapter" ? i : -1))
      .filter((i) => i >= 0)
    const from = starts[chapterIndex]
    if (from === undefined) selected = blocks
    else {
      const to = starts[chapterIndex + 1] ?? blocks.length
      selected = blocks.slice(from, to)
    }
  } else {
    selected = blocks
  }

  return selected
    .filter((b) => b.text.trim())
    .map((b) => {
      if (b.level === "chapter") return `Chapter: ${b.text}`
      if (b.level === "section") return `Section: ${b.text}`
      return `  - ${b.text}`
    })
    .join("\n")
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Educator checks (same guard as /educator/questions/generate)
  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active, token_cap, tokens_used")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent") {
    return NextResponse.json({ error: "Only educators can generate quizzes." }, { status: 403 })
  }
  if (profile?.account_status !== "approved") {
    return NextResponse.json({ error: "Account pending approval." }, { status: 403 })
  }
  if (profile?.is_active === false) {
    return NextResponse.json({ error: "Account deactivated. Contact the admin." }, { status: 403 })
  }
  if (
    profile.token_cap !== null &&
    profile.token_cap !== undefined &&
    (profile.tokens_used ?? 0) >= profile.token_cap
  ) {
    return NextResponse.json({ error: "Token cap reached. Contact your admin." }, { status: 429 })
  }

  // Book access check
  const { data: book } = await supabase
    .from("books")
    .select("id, title, blocks, owner_id")
    .eq("id", id)
    .single()

  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 })

  if (book.owner_id !== user.id) {
    const { data: collab } = await supabase
      .from("book_collaborators")
      .select("role")
      .eq("book_id", id)
      .eq("user_id", user.id)
      .single()
    if (!collab || collab.role !== "editor") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
  }

  const body = await req.json() as Body
  const { name, scope, difficulty, questionCount } = body
  const chapterIndex = body.chapterIndex ?? 0

  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty." }, { status: 400 })
  }
  if (questionCount < 1 || questionCount > 30) {
    return NextResponse.json({ error: "questionCount must be 1–30." }, { status: 400 })
  }

  const text = extractText(book.blocks as FlatBlock[], scope, chapterIndex)
  if (!text.trim()) {
    return NextResponse.json({ error: "The selected scope has no content." }, { status: 400 })
  }

  const { question_approval_threshold } = await getPlatformSettings()

  // For very large requests, queue for admin approval (reuse same threshold)
  if (questionCount > question_approval_threshold) {
    const { data: genReq, error: reqErr } = await supabase
      .from("generation_requests")
      .insert({
        requested_by: user.id,
        document_ids: [],
        prompt_context: text.slice(0, 2000),
        name: name.trim(),
        question_count: questionCount,
        config: { difficulty, source: "book", book_id: id, scope, chapter_index: chapterIndex },
        status: "pending_admin",
      })
      .select("id")
      .single()

    if (reqErr || !genReq) {
      return NextResponse.json({ error: "Failed to queue request." }, { status: 500 })
    }

    return NextResponse.json({ status: "pending_admin", request_id: genReq.id }, { status: 202 })
  }

  // Record generation request
  const { data: genReq, error: reqErr } = await supabase
    .from("generation_requests")
    .insert({
      requested_by: user.id,
      document_ids: [],
      prompt_context: text.slice(0, 2000),
      name: name.trim(),
      question_count: questionCount,
      config: { difficulty, source: "book", book_id: id, scope, chapter_index: chapterIndex },
      status: "approved",
    })
    .select("id")
    .single()

  if (reqErr || !genReq) {
    return NextResponse.json({ error: "Failed to create request." }, { status: 500 })
  }

  try {
    const { questions, tokensUsed } = await generateQuestionsFromPrompt({
      prompt: text,
      difficulty,
      questionCount,
    })

    const rows = questions.map((q) => ({
      owner_id: user.id,
      generation_request_id: genReq.id,
      question_text: q.body,
      options: [
        { label: "A", text: q.options.A, is_correct: q.correct === "A" },
        { label: "B", text: q.options.B, is_correct: q.correct === "B" },
        { label: "C", text: q.options.C, is_correct: q.correct === "C" },
        { label: "D", text: q.options.D, is_correct: q.correct === "D" },
      ],
      explanation: q.explanation,
      difficulty,
      topic_tags: [q.topic],
      status: "pending_review",
    }))

    const { error: insertErr } = await supabase.from("questions").insert(rows)
    if (insertErr) throw new Error(insertErr.message)

    const admin = createAdminClient()
    await Promise.all([
      admin
        .from("generation_requests")
        .update({ status: "completed", tokens_used: tokensUsed })
        .eq("id", genReq.id),
      admin.rpc("increment_educator_tokens", { p_user_id: user.id, p_delta: tokensUsed }),
    ])

    return NextResponse.json({
      status: "completed",
      question_count: rows.length,
      request_id: genReq.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed."
    console.error("[books/generate-quiz]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
