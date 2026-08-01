import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify assignment and fetch policies
  const { data: assignment } = await supabase
    .from("test_assignments")
    .select("id, allow_retake")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .single()

  if (!assignment) return NextResponse.json({ error: "Test not assigned to you." }, { status: 403 })

  // Enforce single-attempt policy on submit
  if (!assignment.allow_retake) {
    const { count } = await supabase
      .from("test_attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId)
      .eq("student_id", user.id)
      .not("completed_at", "is", null)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "Retakes are not allowed for this test." }, { status: 403 })
    }
  }

  const { answers } = await request.json() as { answers: Record<string, string> }
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers object is required." }, { status: 400 })
  }

  // Determine attempt number and whether this is the first
  const { data: existingAttempts } = await supabase
    .from("test_attempts")
    .select("id, attempt_number")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .order("attempt_number", { ascending: false })
    .limit(1)

  const lastAttemptNumber = existingAttempts?.[0]?.attempt_number ?? 0
  const attemptNumber = lastAttemptNumber + 1
  const isFirstAttempt = attemptNumber === 1

  // Fetch test
  const { data: test } = await supabase
    .from("tests")
    .select("id, title, question_ids, time_limit_min")
    .eq("id", testId)
    .single()

  if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 })

  // Fetch questions with correct answers
  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, options, explanation, difficulty, topic_tags")
    .in("id", test.question_ids)
    .eq("status", "approved")

  if (!questions) return NextResponse.json({ error: "Failed to load questions." }, { status: 500 })

  // Score
  let score = 0
  const graded = (test.question_ids as string[]).map((qid) => {
    const q = questions.find((x) => x.id === qid)
    if (!q) return null
    const opts = q.options as { label: string; text: string; is_correct: boolean }[]
    const correctLabel = opts.find((o) => o.is_correct)?.label ?? null
    const studentAnswer = answers[qid] ?? null
    const isCorrect = correctLabel !== null && studentAnswer === correctLabel
    if (isCorrect) score++
    return {
      id: qid,
      question_text: q.question_text,
      options: opts,
      explanation: q.explanation,
      difficulty: q.difficulty,
      topic_tags: q.topic_tags,
      student_answer: studentAnswer,
      correct_answer: correctLabel,
      is_correct: isCorrect,
    }
  }).filter(Boolean)

  const maxScore = questions.length

  const { data: attempt, error: insertErr } = await supabase
    .from("test_attempts")
    .insert({
      test_id: testId,
      student_id: user.id,
      answers,
      score,
      max_score: maxScore,
      attempt_number: attemptNumber,
      is_first_attempt: isFirstAttempt,
      config_snapshot: { title: test.title, time_limit_min: test.time_limit_min, question_count: maxScore },
      completed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr || !attempt) {
    return NextResponse.json({ error: "Failed to save attempt." }, { status: 500 })
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  return NextResponse.json({
    attempt_id: attempt.id,
    attempt_number: attemptNumber,
    is_first_attempt: isFirstAttempt,
    score,
    max_score: maxScore,
    pct,
    questions: graded,
  })
}
