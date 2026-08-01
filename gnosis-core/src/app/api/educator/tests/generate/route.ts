import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateBlended, toughnessToDifficulty, embedQuery } from "@/lib/ai/quiz-generator"
import { getEffectiveQuestionThreshold } from "@/lib/platform-settings"
import { sendAdminGenerationRequestAlert } from "@/lib/email/send-admin-alert"
import { NextResponse } from "next/server"

export const maxDuration = 300

interface GenerateBody {
  name: string
  chapter_ids: string[]
  prompt: string
  prompt_pct: number    // 0-100
  toughness: number     // 0-100
  question_count: number
}

async function getEducator(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active, token_cap, tokens_used")
    .eq("id", user.id)
    .single()
  if (
    profile?.role !== "educator_parent" ||
    profile.account_status !== "approved" ||
    profile.is_active === false
  ) return null
  if (profile.token_cap !== null && profile.token_cap !== undefined && (profile.tokens_used ?? 0) >= profile.token_cap) {
    return null
  }
  return user
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized or token cap reached." }, { status: 401 })

  const body = await request.json() as GenerateBody
  const {
    name,
    chapter_ids = [],
    prompt = "",
    prompt_pct,
    toughness,
    question_count,
  } = body

  // ── Validation ────────────────────────────────────────────────
  if (!name?.trim()) {
    return NextResponse.json({ error: "Test name is required." }, { status: 400 })
  }
  if (!Array.isArray(chapter_ids)) {
    return NextResponse.json({ error: "chapter_ids must be an array." }, { status: 400 })
  }

  const hasChapters = chapter_ids.length > 0
  const hasPrompt = prompt.trim().length > 0

  if (!hasChapters && !hasPrompt) {
    return NextResponse.json(
      { error: "Select at least one chapter or enter a custom prompt." },
      { status: 400 }
    )
  }

  const pct = typeof prompt_pct === "number" ? Math.max(0, Math.min(100, prompt_pct)) : (hasChapters ? 20 : 100)
  const tough = typeof toughness === "number" ? Math.max(0, Math.min(100, toughness)) : 50
  const count = typeof question_count === "number" && question_count >= 1 ? Math.min(question_count, 100) : 20

  if (!hasChapters && !hasPrompt) {
    return NextResponse.json({ error: "A prompt is required when no chapters are selected." }, { status: 400 })
  }

  // Prompt-only: must have prompt text
  if (!hasChapters && !hasPrompt) {
    return NextResponse.json({ error: "Enter a prompt to generate questions from." }, { status: 400 })
  }

  // ── Resolve chapters → document IDs ───────────────────────────
  let chapterDocIds: string[] = []
  if (hasChapters) {
    // Verify chapters belong to this user
    const { data: chapters, error: chapErr } = await supabase
      .from("chapters")
      .select("id")
      .in("id", chapter_ids)
      .eq("user_id", user.id)

    if (chapErr || !chapters || chapters.length !== chapter_ids.length) {
      return NextResponse.json({ error: "One or more chapters not found." }, { status: 400 })
    }

    // Fetch ready document IDs from those chapters
    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("id")
      .in("chapter_id", chapter_ids)
      .eq("owner_id", user.id)
      .eq("processing_status", "ready")

    if (docErr) {
      return NextResponse.json({ error: "Failed to load chapter documents." }, { status: 500 })
    }

    chapterDocIds = (docs ?? []).map((d) => d.id)

    if (chapterDocIds.length === 0) {
      return NextResponse.json(
        { error: "The selected chapters have no processed documents. Upload and wait for processing to complete." },
        { status: 400 }
      )
    }
  }

  const threshold = await getEffectiveQuestionThreshold(user.id)

  try {
    // ── Anti-hallucination: verify RAG chunks exist before queuing ─
    if (hasChapters && chapterDocIds.length > 0) {
      const queryText = prompt.trim() || "important concepts and key facts"
      const embedding = await embedQuery(queryText)
      const { data: chunks, error: ragErr } = await supabase.rpc("match_chunks", {
        query_embedding: `[${embedding.join(",")}]`,
        document_ids: chapterDocIds,
        similarity_threshold: 0,
        match_count: 1,
      })
      if (ragErr) throw new Error(ragErr.message)
      if (!chunks || (chunks as unknown[]).length === 0) {
        throw new Error(
          "No content found in the selected chapters. Please re-process the documents and try again."
        )
      }
    }

    // ── Pending admin approval path ───────────────────────────────
    if (count > threshold) {
      const { data: genReq, error: reqErr } = await supabase
        .from("generation_requests")
        .insert({
          requested_by: user.id,
          document_ids: chapterDocIds,
          chapter_ids,
          prompt_context: prompt.trim() || null,
          name: name.trim(),
          question_count: count,
          prompt_pct: pct,
          toughness: tough,
          config: {
            difficulty: toughnessToDifficulty(tough),
            chapter_ids,
            prompt_pct: pct,
            toughness: tough,
          },
          status: "pending_admin",
        })
        .select()
        .single()

      if (reqErr || !genReq) {
        return NextResponse.json({ error: "Failed to submit generation request." }, { status: 500 })
      }

      const adminDb = createAdminClient()
      const { data: adminUser } = await adminDb.from("users").select("email").eq("role", "admin").limit(1).single()
      if (adminUser?.email) {
        const { data: educatorProfile } = await supabase.from("users").select("email, full_name").eq("id", user.id).single()
        sendAdminGenerationRequestAlert({
          adminEmail: adminUser.email,
          educatorName: educatorProfile?.full_name ?? "Unknown",
          educatorEmail: educatorProfile?.email ?? "",
          requestName: name.trim(),
          questionCount: count,
        }).catch((err: unknown) => console.error("[tests/generate] admin alert failed:", (err as Error)?.message))
      }

      return NextResponse.json({ status: "pending_admin", request_id: genReq.id }, { status: 202 })
    }

    // ── Immediate generation ──────────────────────────────────────
    const { data: genReq, error: reqErr } = await supabase
      .from("generation_requests")
      .insert({
        requested_by: user.id,
        document_ids: chapterDocIds,
        chapter_ids,
        prompt_context: prompt.trim() || null,
        name: name.trim(),
        question_count: count,
        prompt_pct: pct,
        toughness: tough,
        config: {
          difficulty: toughnessToDifficulty(tough),
          chapter_ids,
          prompt_pct: pct,
          toughness: tough,
        },
        status: "approved",
      })
      .select()
      .single()

    if (reqErr || !genReq) {
      return NextResponse.json({ error: "Failed to create generation record." }, { status: 500 })
    }

    const { questions, tokensUsed } = await generateBlended({
      chapterDocIds,
      prompt: prompt.trim(),
      promptPct: pct,
      toughness: tough,
      questionCount: count,
      supabase,
    })

    const difficulty = toughnessToDifficulty(tough)
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

    const { data: insertedQs, error: insertErr } = await supabase
      .from("questions")
      .insert(rows)
      .select("id")
    if (insertErr) throw new Error(`Failed to store questions: ${insertErr.message}`)

    const questionIds = (insertedQs ?? []).map((q) => q.id)

    // Create a draft test for the review screen
    const { data: draftTest } = await supabase
      .from("tests")
      .insert({
        creator_id: user.id,
        title: name.trim(),
        question_ids: questionIds,
        is_published: false,
      })
      .select("id")
      .single()

    const adminDb = createAdminClient()
    await Promise.all([
      adminDb
        .from("generation_requests")
        .update({ status: "completed", tokens_used: tokensUsed })
        .eq("id", genReq.id),
      adminDb.rpc("increment_educator_tokens", { p_user_id: user.id, p_delta: tokensUsed }),
    ])

    return NextResponse.json(
      { status: "completed", question_count: rows.length, request_id: genReq.id, test_id: draftTest?.id },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed."
    console.error("[tests/generate]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
