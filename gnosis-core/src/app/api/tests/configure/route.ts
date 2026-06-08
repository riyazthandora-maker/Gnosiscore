import { createClient } from "@/lib/supabase/server"
import { generateQuestions } from "@/lib/ai/quiz-generator"
import { checkRateLimit, LIMITS } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import type { Toughness, ShowAnswerMode, ConfigSnapshot } from "@/types"

interface ConfigureBody {
  document_id: string
  toughness: Toughness
  total_questions: number
  total_time_secs: number | null
  per_question_secs: number | null
  show_answer_mode: ShowAnswerMode
  topic_filter: string[] | null
  config_name: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed, remaining, resetAt } = checkRateLimit(
    `quiz:${user.id}`, LIMITS.quizGenerate.limit, LIMITS.quizGenerate.windowMs
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit reached. You can generate more tests after ${new Date(resetAt).toLocaleTimeString()}.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
    )
  }
  void remaining

  const body: ConfigureBody = await request.json()
  const {
    document_id, toughness, total_questions, total_time_secs,
    per_question_secs, show_answer_mode, topic_filter, config_name,
  } = body

  // Verify the document belongs to this user and is ready
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("id", document_id)
    .eq("user_id", user.id)
    .single()

  if (docErr || !doc) return NextResponse.json({ error: "Document not found." }, { status: 404 })
  if (doc.status !== "ready") return NextResponse.json({ error: "Document is still being processed." }, { status: 409 })

  // Save test config
  const { data: config, error: configErr } = await supabase
    .from("test_configs")
    .insert({
      user_id: user.id,
      document_id,
      name: config_name,
      toughness,
      total_questions,
      total_time_secs,
      per_question_secs,
      show_answer_mode,
      topic_filter,
    })
    .select()
    .single()

  if (configErr || !config) return NextResponse.json({ error: "Failed to save configuration." }, { status: 500 })

  const snapshot: ConfigSnapshot = {
    toughness,
    total_questions,
    total_time_secs,
    per_question_secs,
    show_answer_mode,
    topic_filter,
    document_title: doc.title,
  }

  // Create attempt record
  const { data: attempt, error: attemptErr } = await supabase
    .from("test_attempts")
    .insert({
      config_id: config.id,
      user_id: user.id,
      config_snapshot: snapshot,
      status: "in_progress",
    })
    .select()
    .single()

  if (attemptErr || !attempt) return NextResponse.json({ error: "Failed to create test attempt." }, { status: 500 })

  // Generate questions via Claude
  let questions
  try {
    ;({ questions } = await generateQuestions({
      documentIds: [document_id],
      difficulty: toughness as import("@/types").Difficulty,
      questionCount: total_questions,
      topic: (topic_filter as string[] | null)?.join(", ") ?? undefined,
      supabase,
    }))
  } catch (err) {
    // Roll back the attempt on AI failure
    await supabase.from("test_attempts").delete().eq("id", attempt.id)
    await supabase.from("test_configs").delete().eq("id", config.id)
    const message = err instanceof Error ? err.message : "Failed to generate questions."
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Persist questions
  const questionRows = questions.map((q, i) => ({
    attempt_id: attempt.id,
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
    difficulty: toughness,
  }))

  const { error: questionsErr } = await supabase.from("questions").insert(questionRows)
  if (questionsErr) return NextResponse.json({ error: "Failed to save questions." }, { status: 500 })

  return NextResponse.json({ attempt_id: attempt.id }, { status: 201 })
}
