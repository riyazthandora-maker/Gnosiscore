import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { genAI, DIAGNOSTIC_MODEL, withRetry } from "@/lib/ai/gemini"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Verify educator-student link
  const { data: link } = await supabase
    .from("educator_students")
    .select("id")
    .eq("educator_id", user.id)
    .eq("student_id", studentId)
    .single()

  if (!link) return NextResponse.json({ error: "Student not linked to your account." }, { status: 403 })

  // Fetch student profile via admin client — RLS blocks educators from reading other users' rows
  const adminDb = createAdminClient()
  const { data: student } = await adminDb
    .from("users")
    .select("id, full_name, email")
    .eq("id", studentId)
    .single()

  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 })

  // Fetch all completed first attempts by this student for tests created by this educator
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, test_id, score, max_score, answers, config_snapshot, started_at, completed_at, attempt_number, is_first_attempt")
    .eq("student_id", studentId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })

  const allAttempts = attempts ?? []

  // Filter to first attempts only for teacher dashboard
  const firstAttempts = allAttempts.filter((a) => a.is_first_attempt)

  // Fetch test titles for the attempts
  const testIds = [...new Set(firstAttempts.map((a) => a.test_id))]
  const { data: tests } = await supabase
    .from("tests")
    .select("id, title")
    .in("id", testIds.length > 0 ? testIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("creator_id", user.id)

  const testMap: Record<string, string> = {}
  for (const t of tests ?? []) testMap[t.id] = t.title

  // Build exam history (only tests created by this educator)
  const examHistory = firstAttempts
    .filter((a) => testMap[a.test_id])
    .map((a) => {
      const snap = a.config_snapshot as Record<string, unknown>
      const pct = a.max_score ? Math.round((a.score / a.max_score) * 100) : 0
      return {
        attempt_id: a.id,
        test_id: a.test_id,
        test_title: testMap[a.test_id] ?? (snap?.title as string) ?? "Unknown",
        score: a.score,
        max_score: a.max_score,
        pct,
        completed_at: a.completed_at,
        total_attempts: allAttempts.filter((x) => x.test_id === a.test_id).length,
      }
    })

  // Class average per test (all students on these tests)
  const classAverages: Record<string, number> = {}
  if (testIds.length > 0) {
    const { data: classAttempts } = await supabase
      .from("test_attempts")
      .select("test_id, score, max_score")
      .in("test_id", testIds)
      .eq("is_first_attempt", true)
      .not("completed_at", "is", null)

    const grouped: Record<string, { total: number; count: number }> = {}
    for (const ca of classAttempts ?? []) {
      if (!grouped[ca.test_id]) grouped[ca.test_id] = { total: 0, count: 0 }
      grouped[ca.test_id].total += ca.max_score ? (ca.score / ca.max_score) * 100 : 0
      grouped[ca.test_id].count++
    }
    for (const [tid, { total, count }] of Object.entries(grouped)) {
      classAverages[tid] = Math.round(total / count)
    }
  }

  // Topic accuracy across all first attempts
  const topicStats: Record<string, { correct: number; total: number }> = {}
  for (const attempt of firstAttempts) {
    const answers = attempt.answers as Record<string, unknown>
    if (!answers || typeof answers !== "object") continue
    // answers contains graded data stored from the submit route
    // We need to re-fetch questions to get topic_tags — use config_snapshot or stored answers
    // answers is { questionId: studentLabel } — we need to check correctness against questions
    // For topic tracking, fetch the questions for these test_ids
  }

  // Fetch questions for all test_ids to compute topic accuracy
  const { data: allQuestions } = await supabase
    .from("questions")
    .select("id, topic_tags, options")
    .in(
      "id",
      [...new Set(
        firstAttempts.flatMap((a) => Object.keys(a.answers as Record<string, unknown> ?? {}))
      )].slice(0, 500)
    )

  const questionMap: Record<string, { topic_tags: string[]; correct_label: string | null }> = {}
  for (const q of allQuestions ?? []) {
    const opts = q.options as { label: string; is_correct: boolean }[]
    questionMap[q.id] = {
      topic_tags: q.topic_tags ?? [],
      correct_label: opts.find((o) => o.is_correct)?.label ?? null,
    }
  }

  for (const attempt of firstAttempts) {
    const answers = attempt.answers as Record<string, string>
    for (const [qid, studentLabel] of Object.entries(answers)) {
      const q = questionMap[qid]
      if (!q) continue
      for (const tag of q.topic_tags) {
        if (!topicStats[tag]) topicStats[tag] = { correct: 0, total: 0 }
        topicStats[tag].total++
        if (q.correct_label && studentLabel === q.correct_label) topicStats[tag].correct++
      }
    }
  }

  const topicAccuracy = Object.entries(topicStats)
    .map(([topic, { correct, total }]) => ({
      topic,
      correct,
      total,
      accuracy_pct: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  // Score trend (chronological)
  const scoreTrend = [...examHistory]
    .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
    .map((e) => ({ test_title: e.test_title, pct: e.pct, completed_at: e.completed_at }))

  // AI advisory — skip if no data
  let aiAdvisory: string | null = null
  if (examHistory.length > 0 && topicAccuracy.length > 0) {
    try {
      const strengths = topicAccuracy.filter((t) => t.accuracy_pct >= 70).slice(0, 5)
      const weaknesses = topicAccuracy.filter((t) => t.accuracy_pct < 60).slice(0, 5)
      const avgScore = Math.round(examHistory.reduce((s, e) => s + e.pct, 0) / examHistory.length)
      const trend = scoreTrend.length >= 2
        ? scoreTrend[scoreTrend.length - 1].pct - scoreTrend[0].pct
        : 0

      const prompt = `You are an educational advisor. A teacher needs a short advisory about a student to share with the student or parents.

Student: ${student.full_name}
Tests taken: ${examHistory.length}
Average score: ${avgScore}%
Score trend: ${trend > 5 ? "improving" : trend < -5 ? "declining" : "stable"}
Strong topics: ${strengths.map((t) => `${t.topic} (${t.accuracy_pct}%)`).join(", ") || "None identified"}
Weak topics: ${weaknesses.map((t) => `${t.topic} (${t.accuracy_pct}%)`).join(", ") || "None identified"}

Write a 3-4 sentence advisory for the teacher/parent. Be encouraging, specific, and actionable. Do not use bullet points. Plain paragraph only.`

      const response = await withRetry(() =>
        genAI.models.generateContent({
          model: DIAGNOSTIC_MODEL,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        })
      )
      aiAdvisory = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
    } catch {
      aiAdvisory = null
    }
  }

  return NextResponse.json({
    student,
    exam_history: examHistory,
    class_averages: classAverages,
    topic_accuracy: topicAccuracy,
    score_trend: scoreTrend,
    ai_advisory: aiAdvisory,
  })
}
