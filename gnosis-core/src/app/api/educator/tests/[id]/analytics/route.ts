import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: test } = await supabase
    .from("tests")
    .select("id, title, question_ids, time_limit_min, is_published, created_at")
    .eq("id", testId)
    .eq("creator_id", user.id)
    .single()

  if (!test) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const [assignmentsRes, attemptsRes, questionsRes] = await Promise.all([
    supabase
      .from("test_assignments")
      .select("student_id")
      .eq("test_id", testId),
    supabase
      .from("test_attempts")
      .select("id, student_id, score, max_score, answers, completed_at, users!student_id(full_name, email)")
      .eq("test_id", testId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
    supabase
      .from("questions")
      .select("id, question_text, options, difficulty, topic_tags")
      .in("id", test.question_ids as string[])
      .eq("status", "approved"),
  ])

  const attempts = attemptsRes.data ?? []
  const questions = questionsRes.data ?? []

  // Score distribution into 5 buckets
  const buckets = ["0–20", "21–40", "41–60", "61–80", "81–100"]
  const distribution = buckets.map((range) => ({ range, count: 0 }))

  const scores = attempts
    .filter((a) => a.max_score && a.max_score > 0)
    .map((a) => Math.round(((a.score ?? 0) / (a.max_score as number)) * 100))

  for (const pct of scores) {
    const idx = Math.min(Math.floor(pct / 20), 4)
    distribution[idx].count++
  }

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : null
  const passRate = scores.length > 0
    ? Math.round((scores.filter((s) => s >= 60).length / scores.length) * 100)
    : null

  // Per-question accuracy
  const orderedQuestions = (test.question_ids as string[])
    .map((qid) => questions.find((q) => q.id === qid))
    .filter(Boolean) as typeof questions

  const questionStats = orderedQuestions.map((q) => {
    const opts = q.options as { label: string; text: string; is_correct: boolean }[]
    const correctLabel = opts.find((o) => o.is_correct)?.label ?? null
    let correct = 0
    for (const attempt of attempts) {
      const ans = (attempt.answers as Record<string, string>)?.[q.id]
      if (ans && ans === correctLabel) correct++
    }
    const total = attempts.length
    return {
      id: q.id,
      question_text: q.question_text,
      difficulty: q.difficulty,
      topic_tags: q.topic_tags,
      attempts: total,
      correct,
      accuracy_pct: total > 0 ? Math.round((correct / total) * 100) : null,
    }
  })

  // Student results
  const studentResults = attempts.map((a) => {
    const profile = a.users as unknown as { full_name: string; email: string }
    const pct = a.max_score && a.max_score > 0
      ? Math.round(((a.score ?? 0) / (a.max_score as number)) * 100)
      : null
    return {
      student_id: a.student_id,
      full_name: profile?.full_name ?? "Unknown",
      email: profile?.email ?? "",
      score: a.score,
      max_score: a.max_score,
      pct,
      completed_at: a.completed_at,
    }
  })

  return NextResponse.json({
    test,
    stats: {
      assigned: assignmentsRes.data?.length ?? 0,
      completed: attempts.length,
      avg_score: avgScore,
      pass_rate: passRate,
      score_distribution: distribution,
    },
    questions: questionStats,
    students: studentResults,
  })
}
