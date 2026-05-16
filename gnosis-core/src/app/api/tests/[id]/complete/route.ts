import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface ResponseInput {
  question_id: string
  selected_option: "A" | "B" | "C" | "D" | null
  time_spent_secs: number | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempt, error: aErr } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single()

  if (aErr || !attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 })
  if (attempt.status !== "in_progress") return NextResponse.json({ error: "Attempt already completed." }, { status: 409 })

  const { responses: inputs }: { responses: ResponseInput[] } = await request.json()

  // Fetch all questions with correct answers
  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, correct_option")
    .eq("attempt_id", attemptId)

  if (qErr || !questions) return NextResponse.json({ error: "Failed to load questions." }, { status: 500 })

  const correctMap = Object.fromEntries(questions.map((q) => [q.id, q.correct_option]))

  const responseRows = inputs.map((r) => ({
    attempt_id: attemptId,
    question_id: r.question_id,
    selected_option: r.selected_option,
    is_correct: r.selected_option != null ? r.selected_option === correctMap[r.question_id] : false,
    time_spent_secs: r.time_spent_secs,
  }))

  const { error: rErr } = await supabase.from("responses").insert(responseRows)
  if (rErr) return NextResponse.json({ error: "Failed to save responses." }, { status: 500 })

  const answered = responseRows.filter((r) => r.selected_option != null).length
  const correct = responseRows.filter((r) => r.is_correct).length
  const scorePct = questions.length > 0 ? (correct / questions.length) * 100 : 0

  const startedAt = new Date(attempt.started_at)
  const timeTakenSecs = Math.round((Date.now() - startedAt.getTime()) / 1000)

  await supabase
    .from("test_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      score_pct: scorePct,
      total_answered: answered,
      time_taken_secs: timeTakenSecs,
    })
    .eq("id", attemptId)

  return NextResponse.json({ attempt_id: attemptId, score_pct: scorePct })
}
