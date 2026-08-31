import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/student/assignments
// Returns all assignments for the logged-in student via student_roster link
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Find the student's roster entry (student_user_id = logged-in user)
  const { data: rosterEntries } = await supabase
    .from("student_roster")
    .select("id")
    .eq("student_user_id", user.id)

  if (!rosterEntries?.length) return NextResponse.json({ assignments: [] })

  const rosterIds = rosterEntries.map(r => r.id as string)

  const { data, error } = await supabase
    .from("exam_assignments")
    .select(`
      *,
      exam_papers ( id, title, questions ),
      exam_sessions ( id, status, attempt_number, score, completed_at )
    `)
    .in("student_roster_id", rosterIds)
    .order("assigned_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ assignments: data ?? [] })
}
