import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestions, generateQuestionsFromPrompt, RAGThresholdError } from "@/lib/ai/quiz-generator"
import { GENERATION_ADMIN_THRESHOLD, RAG_SIMILARITY_THRESHOLD } from "@/types"
import type { Difficulty } from "@/types"
import { NextResponse } from "next/server"

interface GenerateBody {
  name: string
  documentIds?: string[]
  prompt?: string
  questionCount: number
  difficulty: Difficulty
  topic?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, token_cap, tokens_used")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (profile?.account_status !== "approved") {
    return NextResponse.json({ error: "Account pending approval." }, { status: 403 })
  }
  if (profile.token_cap !== null && profile.token_cap !== undefined && (profile.tokens_used ?? 0) >= profile.token_cap) {
    return NextResponse.json({ error: "Token cap reached. Contact your admin to increase the limit." }, { status: 429 })
  }

  const body = await request.json() as GenerateBody
  const { name, documentIds, prompt, questionCount, difficulty, topic } = body

  const hasDocs = Array.isArray(documentIds) && documentIds.length > 0
  const hasPrompt = typeof prompt === "string" && prompt.trim().length > 0

  if (!name?.trim()) {
    return NextResponse.json({ error: "A generation name is required." }, { status: 400 })
  }
  if (!hasDocs && !hasPrompt) {
    return NextResponse.json(
      { error: "Provide at least one document or a prompt to generate questions from." },
      { status: 400 }
    )
  }
  if (!questionCount || !difficulty) {
    return NextResponse.json({ error: "questionCount and difficulty are required." }, { status: 400 })
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    return NextResponse.json({ error: "difficulty must be easy, medium, or hard." }, { status: 400 })
  }
  if (questionCount < 1 || questionCount > 50) {
    return NextResponse.json({ error: "questionCount must be between 1 and 50." }, { status: 400 })
  }

  if (hasDocs) {
    // Verify educator owns all selected documents
    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("id")
      .in("id", documentIds!)
      .eq("owner_id", user.id)
      .eq("processing_status", "ready")

    if (docErr || !docs || docs.length !== documentIds!.length) {
      return NextResponse.json({ error: "One or more documents not found or not ready." }, { status: 400 })
    }
  }

  const promptContext = hasDocs ? (topic?.trim() || prompt?.trim() || null) : (prompt?.trim() ?? null)

  try {
    if (hasDocs && questionCount > GENERATION_ADMIN_THRESHOLD) {
      // RAG validation only — queue for admin approval
      const { RAGThresholdError: RTE, embedQuery } = await import("@/lib/ai/quiz-generator")
      const queryText = promptContext || "important concepts and key facts"
      const embedding = await embedQuery(queryText)
      const { data: chunks, error: ragErr } = await supabase.rpc("match_chunks", {
        query_embedding: embedding,
        document_ids: documentIds,
        similarity_threshold: RAG_SIMILARITY_THRESHOLD,
        match_count: 1,
      })
      if (ragErr) throw new Error(ragErr.message)
      if (!chunks || (chunks as unknown[]).length === 0) throw new RTE()

      const { data: genReq, error: reqErr } = await supabase
        .from("generation_requests")
        .insert({
          requested_by: user.id,
          document_ids: documentIds,
          prompt_context: promptContext,
          name: name.trim(),
          question_count: questionCount,
          config: { difficulty, document_ids: documentIds },
          status: "pending_admin",
        })
        .select()
        .single()

      if (reqErr || !genReq) return NextResponse.json({ error: "Failed to create request." }, { status: 500 })
      return NextResponse.json({ status: "pending_admin", request_id: genReq.id }, { status: 202 })
    }

    // Record the generation request
    const { data: genReq, error: reqErr } = await supabase
      .from("generation_requests")
      .insert({
        requested_by: user.id,
        document_ids: hasDocs ? documentIds : [],
        prompt_context: promptContext,
        name: name.trim(),
        question_count: questionCount,
        config: { difficulty, ...(hasDocs ? { document_ids: documentIds } : {}) },
        status: "approved",
      })
      .select()
      .single()

    if (reqErr || !genReq) return NextResponse.json({ error: "Failed to create request." }, { status: 500 })

    // Generate questions
    const { questions, tokensUsed } = hasDocs
      ? await generateQuestions({
          documentIds: documentIds!,
          difficulty,
          questionCount,
          topic: promptContext ?? undefined,
          supabase,
        })
      : await generateQuestionsFromPrompt({
          prompt: prompt!.trim(),
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
    if (insertErr) throw new Error(`Failed to store questions: ${insertErr.message}`)

    const adminDb = createAdminClient()
    await Promise.all([
      adminDb
        .from("generation_requests")
        .update({ status: "completed", tokens_used: tokensUsed })
        .eq("id", genReq.id),
      adminDb.rpc("increment_educator_tokens", { p_user_id: user.id, p_delta: tokensUsed }),
    ])

    return NextResponse.json({ status: "completed", question_count: rows.length }, { status: 201 })

  } catch (err) {
    if (err instanceof RAGThresholdError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : "Generation failed."
    console.error("[generate] error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
