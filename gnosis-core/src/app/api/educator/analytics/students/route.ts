import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { firstAttempt, meanPct, scorePct, type SessionScoreRow } from "@/lib/exam/scoring"

interface AssignmentRow {
  id: string
  student_roster_id: string
  exam_sessions: SessionScoreRow[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // student_roster (not educator_students) is the source of truth for who is in
  // this teacher's class — only rows with a linked account can have results.
  const { data: roster } = await supabase
    .from("student_roster")
    .select("id, student_user_id, name, email")
    .eq("teacher_id", user.id)
    .not("student_user_id", "is", null)

  if (!roster?.length) return NextResponse.json({ students: [] })

  const { data: assignmentData } = await supabase
    .from("exam_assignments")
    .select("id, student_roster_id, exam_sessions(status, score, max_score, attempt_number, completed_at)")
    .eq("assigned_by", user.id)

  const assignments = (assignmentData ?? []) as unknown as AssignmentRow[]

  const byRoster = new Map<string, AssignmentRow[]>()
  for (const a of assignments) {
    const list = byRoster.get(a.student_roster_id)
    if (list) list.push(a)
    else byRoster.set(a.student_roster_id, [a])
  }

  const students = roster.map((entry) => {
    const mine = byRoster.get(entry.id) ?? []
    const attempts = mine
      .map((a) => firstAttempt(a.exam_sessions ?? []))
      .filter((s): s is SessionScoreRow => s !== null)

    const scores = attempts
      .map(scorePct)
      .filter((p): p is number => p !== null)

    const completedTimes = attempts
      .map((s) => s.completed_at)
      .filter((t): t is string => t !== null)
      .sort()

    return {
      id: entry.student_user_id as string,
      full_name: entry.name,
      email: entry.email,
      assigned: mine.length,
      completed: attempts.length,
      avg_score: meanPct(scores),
      last_attempt_at: completedTimes.length > 0 ? completedTimes[completedTimes.length - 1] : null,
    }
  })

  students.sort((a, b) => (b.completed - a.completed) || (b.avg_score ?? -1) - (a.avg_score ?? -1))

  return NextResponse.json({ students })
}
