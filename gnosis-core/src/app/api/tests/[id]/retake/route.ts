import { createClient } from "@/lib/supabase/server"
import { generateQuestions } from "@/lib/ai/quiz-generator"
import { checkRateLimit, LIMITS } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import type { ConfigSnapshot, Toughness, ShowAnswerMode } from "@/types"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Rate limit
  const { allowed, resetAt } = checkRateLimit(
    `quiz:${user.id}`, LIMITS.quizGenerate.limit, LIMITS.quizGenerate.windowMs
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. Try again after ${new Date(resetAt).toLocaleTimeString()}.` },
      { status: 429 }
    )
  }

  // Fetch original attempt to get config
  const { data: original } = await supabase
    .from("test_attempts")
    .select("config_id, config_snapshot")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single()

  if (!original) return NextResponse.json({ error: "Attempt not found." }, { status: 404 })

  const snap = original.config_snapshot as ConfigSnapshot

  // Fetch config for document_id and topic_filter
  const { data: config } = await supabase
    .from("test_configs")
    .select("document_id, topic_filter, documents(status)")
    .eq("id", original.config_id)
    .single()

  if (!config) return NextResponse.json({ error: "Config not found." }, { status: 404 })

  const doc = config.documents as unknown as { status: string }
  if (doc?.status !== "ready") {
    return NextResponse.json({ error: "Source document is not ready." }, { status: 409 })
  }

  // Create new attempt with same config snapshot
  const { data: newAttempt, error: aErr } = await supabase
    .from("test_attempts")
    .insert({
      config_id: original.config_id,
      user_id: user.id,
      config_snapshot: snap,
      status: "in_progress",
    })
    .select()
    .single()

  if (aErr || !newAttempt) return NextResponse.json({ error: "Failed to create attempt." }, { status: 500 })

  // Generate fresh questions
  let questions
  try {
    ;({ questions } = await generateQuestions({
      documentIds: [config.document_id as string],
      difficulty: ((snap.toughness as string) ?? "medium") as import("@/types").Difficulty,
      questionCount: (snap.total_questions as number) ?? 10,
      topic: (config.topic_filter as string[] | null)?.join(", ") ?? undefined,
      supabase,
    }))
  } catch (err) {
    await supabase.from("test_attempts").delete().eq("id", newAttempt.id)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed." }, { status: 502 })
  }

  const rows = questions.map((q, i) => ({
    attempt_id: newAttempt.id,
    seq_number: i + 1,
    body: q.body,
    options: [
      { label: "A", text: q.options.A },
      { label: "B", text: q.options.B },
      { label: "C", text: q.options.C },
      { label: "D", text: q.options.D },
    ],
    correct_option: q.correct,
    explanation: q.explanation,
    topic_tag: q.topic,
    difficulty: snap.toughness,
  }))

  await supabase.from("questions").insert(rows)

  return NextResponse.json({ attempt_id: newAttempt.id }, { status: 201 })
}
