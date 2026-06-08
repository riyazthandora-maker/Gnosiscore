import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [testsRes, studentsRes, assignmentsRes, attemptsRes, bankRes] = await Promise.all([
    supabase.from("tests").select("id, is_published").eq("creator_id", user.id),
    supabase.from("educator_students").select("student_id", { count: "exact", head: true }).eq("educator_id", user.id),
    supabase
      .from("test_assignments")
      .select("test_id, tests!inner(creator_id)")
      .eq("tests.creator_id", user.id),
    supabase
      .from("test_attempts")
      .select("test_id, score, max_score, tests!inner(creator_id)")
      .eq("tests.creator_id", user.id)
      .not("completed_at", "is", null),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "approved"),
  ])

  const tests = testsRes.data ?? []
  const attempts = attemptsRes.data ?? []

  const scores = attempts
    .filter((a) => a.max_score && a.max_score > 0)
    .map((a) => Math.round(((a.score ?? 0) / (a.max_score as number)) * 100))

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null

  return NextResponse.json({
    students: studentsRes.count ?? 0,
    tests: tests.length,
    published_tests: tests.filter((t) => t.is_published).length,
    total_assignments: assignmentsRes.data?.length ?? 0,
    total_completions: attempts.length,
    avg_score_pct: avgScore,
    approved_questions: bankRes.count ?? 0,
  })
}
