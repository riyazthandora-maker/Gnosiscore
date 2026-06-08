import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get linked student IDs (educator_students policy allows this)
  const { data: links } = await supabase
    .from("educator_students")
    .select("student_id")
    .eq("educator_id", user.id)

  if (!links?.length) return NextResponse.json({ students: [] })

  const studentIds = links.map((l) => l.student_id)

  // Fetch student profiles via admin client — users_self RLS would block cross-user reads
  const adminDb = createAdminClient()
  const { data: profiles } = await adminDb
    .from("users")
    .select("id, full_name, email")
    .in("id", studentIds)
    .eq("role", "student")

  if (!profiles?.length) return NextResponse.json({ students: [] })

  // Get educator's test IDs to scope assignments + attempts
  const { data: tests } = await supabase
    .from("tests")
    .select("id")
    .eq("creator_id", user.id)

  const testIds = tests?.map((t) => t.id) ?? []

  if (!testIds.length) {
    const students = profiles.map((p) => ({
      id: p.id, full_name: p.full_name, email: p.email,
      assigned: 0, completed: 0, avg_score: null, last_attempt_at: null,
    }))
    return NextResponse.json({ students })
  }

  const [assignmentsRes, attemptsRes] = await Promise.all([
    supabase
      .from("test_assignments")
      .select("student_id, test_id")
      .in("student_id", studentIds)
      .in("test_id", testIds),
    supabase
      .from("test_attempts")
      .select("student_id, test_id, score, max_score, completed_at")
      .in("student_id", studentIds)
      .in("test_id", testIds)
      .not("completed_at", "is", null),
  ])

  const assignments = assignmentsRes.data ?? []
  const attempts = attemptsRes.data ?? []

  const students = profiles.map((profile) => {
    const sid = profile.id

    const studentAssignments = assignments.filter((a) => a.student_id === sid)
    const studentAttempts = attempts.filter((a) => a.student_id === sid)

    const scores = studentAttempts
      .filter((a) => a.max_score && a.max_score > 0)
      .map((a) => Math.round(((a.score ?? 0) / (a.max_score as number)) * 100))

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : null

    const lastAttempt = studentAttempts
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0]

    return {
      id: sid,
      full_name: profile.full_name,
      email: profile.email,
      assigned: studentAssignments.length,
      completed: studentAttempts.length,
      avg_score: avgScore,
      last_attempt_at: lastAttempt?.completed_at ?? null,
    }
  })

  students.sort((a, b) => (b.completed - a.completed) || (b.avg_score ?? -1) - (a.avg_score ?? -1))

  return NextResponse.json({ students })
}
