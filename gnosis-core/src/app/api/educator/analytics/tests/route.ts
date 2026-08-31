import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, question_ids, is_published, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })

  if (!tests?.length) return NextResponse.json({ tests: [] })

  const testIds = tests.map((t) => t.id)

  const { data: attemptsData } = await supabase
    .from("test_attempts")
    .select("test_id, score, max_score")
    .in("test_id", testIds)
    .not("completed_at", "is", null)

  const attempts = attemptsData ?? []

  const result = tests.map((test) => {
    const testAttempts = attempts.filter((a) => a.test_id === test.id)

    const scores = testAttempts
      .filter((a) => a.max_score && a.max_score > 0)
      .map((a) => Math.round(((a.score ?? 0) / (a.max_score as number)) * 100))

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : null

    const passRate = scores.length > 0
      ? Math.round((scores.filter((s) => s >= 60).length / scores.length) * 100)
      : null

    return {
      id: test.id,
      title: test.title,
      is_published: test.is_published,
      question_count: (test.question_ids as string[]).length,
      created_at: test.created_at,
      assigned: 0,
      completed: testAttempts.length,
      avg_score: avgScore,
      pass_rate: passRate,
    }
  })

  return NextResponse.json({ tests: result })
}
