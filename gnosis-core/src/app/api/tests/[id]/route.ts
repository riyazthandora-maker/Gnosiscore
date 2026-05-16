import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempt, error: aErr } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (aErr || !attempt) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("attempt_id", id)
    .order("seq_number")

  if (qErr) return NextResponse.json({ error: "Failed to load questions." }, { status: 500 })

  // Strip correct answers unless show_answer_mode is 'immediate'
  // (client handles immediate reveal; we strip for end/hidden to avoid spoiling network tab)
  const snapshot = attempt.config_snapshot as { show_answer_mode: string }
  const scrubAnswers = snapshot.show_answer_mode !== "immediate"

  const safeQuestions = scrubAnswers
    ? questions.map(({ correct_option: _c, explanation: _e, ...q }) => q)
    : questions

  return NextResponse.json({ attempt, questions: safeQuestions })
}
