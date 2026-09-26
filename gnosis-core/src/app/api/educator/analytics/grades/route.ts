import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { firstAttempt, meanPct, scorePct, type SessionScoreRow } from "@/lib/exam/scoring"

interface RosterEntry {
  id: string
  student_user_id: string | null
  grade_id: string | null
  student_grades: { id: string; name: string } | null
}

interface AssignmentRow {
  id: string
  student_roster_id: string
  exam_sessions: SessionScoreRow[]
}

export interface GradeRow {
  id: string
  name: string
  student_count: number
  assigned: number
  completed: number
  avg_score: number | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rosterData } = await supabase
    .from("student_roster")
    .select("id, student_user_id, grade_id, student_grades(id, name)")
    .eq("teacher_id", user.id)

  const roster = (rosterData ?? []) as unknown as RosterEntry[]

  if (!roster.length) return NextResponse.json({ grades: [] })

  const rosterIds = roster.map((r) => r.id)

  const { data: assignmentData } = await supabase
    .from("exam_assignments")
    .select("id, student_roster_id, exam_sessions(status, score, max_score, attempt_number, completed_at)")
    .eq("assigned_by", user.id)
    .in("student_roster_id", rosterIds)

  const assignments = (assignmentData ?? []) as unknown as AssignmentRow[]

  const byRoster = new Map<string, AssignmentRow[]>()
  for (const a of assignments) {
    const list = byRoster.get(a.student_roster_id)
    if (list) list.push(a)
    else byRoster.set(a.student_roster_id, [a])
  }

  // Group roster entries by grade
  const gradeMap = new Map<string, { name: string; entries: RosterEntry[] }>()
  for (const entry of roster) {
    const grade = entry.student_grades
    const key = grade?.id ?? "__none__"
    const name = grade?.name ?? "Unassigned"
    const existing = gradeMap.get(key)
    if (existing) existing.entries.push(entry)
    else gradeMap.set(key, { name, entries: [entry] })
  }

  const grades: GradeRow[] = []

  for (const [gradeId, { name, entries }] of gradeMap) {
    let assigned = 0
    let completed = 0
    const scores: number[] = []

    for (const entry of entries) {
      const mine = byRoster.get(entry.id) ?? []
      assigned += mine.length

      for (const a of mine) {
        const fa = firstAttempt(a.exam_sessions ?? [])
        if (!fa) continue
        completed++
        const pct = scorePct(fa)
        if (pct !== null) scores.push(pct)
      }
    }

    grades.push({
      id: gradeId,
      name,
      student_count: entries.length,
      assigned,
      completed,
      avg_score: meanPct(scores),
    })
  }

  grades.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ grades })
}
