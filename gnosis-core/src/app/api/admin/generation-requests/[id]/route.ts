import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestions, RAGThresholdError } from "@/lib/ai/quiz-generator"
import { sendGenerationNotification } from "@/lib/email/send-generation-notification"
import type { Difficulty } from "@/types"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, note }: { action: "approve" | "reject"; note?: string } = await request.json()
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }
  if (action === "reject" && !note?.trim()) {
    return NextResponse.json({ error: "A reason is required when rejecting a generation request." }, { status: 400 })
  }

  const adminDb = createAdminClient()

  const { data: genReq, error: fetchErr } = await adminDb
    .from("generation_requests")
    .select("id, requested_by, status, document_ids, question_count, config, prompt_context, name")
    .eq("id", id)
    .single()

  if (fetchErr || !genReq) return NextResponse.json({ error: "Request not found." }, { status: 404 })
  if (genReq.status !== "pending_admin") {
    return NextResponse.json({ error: "Request is no longer pending." }, { status: 409 })
  }

  const newStatus = action === "approve" ? "approved" : "rejected"

  await adminDb
    .from("generation_requests")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      admin_note: note ?? null,
    })
    .eq("id", id)

  await adminDb.from("notifications").insert({
    user_id: genReq.requested_by,
    type: action === "approve" ? "generation_approved" : "generation_rejected",
    payload: { request_id: id, admin_note: note ?? null },
  })

  // Email educator — fire-and-forget
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
  Promise.resolve(
    adminDb.from("users").select("email, full_name").eq("id", genReq.requested_by).single()
  ).then(({ data: educator }) => {
    if (!educator?.email) return
    return sendGenerationNotification({
      toEmail: educator.email,
      educatorName: educator.full_name ?? "Educator",
      generationName: genReq.name || "your request",
      questionCount: genReq.question_count,
      type: action === "approve" ? "approved" : "rejected",
      adminNote: note ?? null,
      reviewUrl: `${appUrl}/tests/review`,
    })
  }).catch((err: Error) => console.error("[generation-request] email failed:", err?.message))

  if (action === "approve") {
    // Fire generation asynchronously — admin gets instant response
    runGeneration(genReq, adminDb).catch((err) => {
      console.error(`[admin-generate] request ${id} failed:`, err)
    })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

async function runGeneration(
  genReq: {
    id: string
    requested_by: string
    document_ids: string[]
    question_count: number
    config: Record<string, unknown>
    prompt_context: string | null
    name: string
  },
  adminDb: ReturnType<typeof createAdminClient>
) {
  try {
    const difficulty = (genReq.config?.difficulty as Difficulty) ?? "medium"
    const topic = genReq.prompt_context ?? undefined

    const { questions, tokensUsed } = await generateQuestions({
      documentIds: genReq.document_ids,
      difficulty,
      questionCount: genReq.question_count,
      topic,
      supabase: adminDb,
    })

    const rows = questions.map((q) => ({
      owner_id: genReq.requested_by,
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

    await adminDb.from("questions").insert(rows)

    await Promise.all([
      adminDb
        .from("generation_requests")
        .update({ status: "completed", tokens_used: tokensUsed })
        .eq("id", genReq.id),
      adminDb.rpc("increment_educator_tokens", { p_user_id: genReq.requested_by, p_delta: tokensUsed }),
    ])

    // Notify educator that questions are ready to review
    await adminDb.from("notifications").insert({
      user_id: genReq.requested_by,
      type: "questions_ready",
      payload: { request_id: genReq.id, count: rows.length },
    })

    // Email educator — fire-and-forget
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"
    Promise.resolve(
      adminDb.from("users").select("email, full_name").eq("id", genReq.requested_by).single()
    ).then(({ data: educator }) => {
      if (!educator?.email) return
      return sendGenerationNotification({
        toEmail: educator.email,
        educatorName: educator.full_name ?? "Educator",
        generationName: genReq.name || "your request",
        questionCount: rows.length,
        type: "questions_ready",
        reviewUrl: `${appUrl}/tests/review`,
      })
    }).catch((err: Error) => console.error("[admin-generate] questions_ready email failed:", err?.message))
  } catch (err) {
    const message = err instanceof RAGThresholdError
      ? err.message
      : err instanceof Error ? err.message : "Generation failed."

    await adminDb
      .from("generation_requests")
      .update({ admin_note: `Generation failed: ${message}` })
      .eq("id", genReq.id)
  }
}
