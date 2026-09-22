import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: roster } = await supabase
    .from("student_roster")
    .select("grade_id")
    .eq("student_user_id", user.id)
    .not("grade_id", "is", null)
    .limit(1)
    .single()

  if (!roster?.grade_id) return NextResponse.json({ plans: [] })

  const { data, error } = await supabase
    .from("pacing_plans")
    .select(`
      id, title, academic_year, start_month,
      books ( id, title ),
      student_grades ( id, name ),
      pacing_milestones ( id, node_id, node_level, node_title, month, week_in_month, topic_notes )
    `)
    .eq("grade_id", roster.grade_id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data ?? [] })
}
