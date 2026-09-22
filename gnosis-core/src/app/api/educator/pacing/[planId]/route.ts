import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pacing_plans")
    .select(`
      id, title, academic_year, start_month, created_at,
      auto_assess_enabled, difficulty_bands, auto_question_count, auto_duration_minutes,
      books ( id, title, blocks ),
      student_grades ( id, name ),
      pacing_milestones ( id, node_id, node_level, node_title, month, week_in_month, topic_notes, milestone_type, auto_exam_paper_id, auto_exam_status )
    `)
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (error) return NextResponse.json({ error: "Plan not found." }, { status: 404 })
  return NextResponse.json({ plan: data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title)                                   updates.title = body.title.trim()
  if (body.academic_year)                           updates.academic_year = body.academic_year
  if (body.start_month)                             updates.start_month = body.start_month
  if (typeof body.auto_assess_enabled === "boolean") updates.auto_assess_enabled = body.auto_assess_enabled
  if (body.difficulty_bands)                        updates.difficulty_bands = body.difficulty_bands
  if (body.auto_question_count)                     updates.auto_question_count = body.auto_question_count
  if (body.auto_duration_minutes)                   updates.auto_duration_minutes = body.auto_duration_minutes

  const { error } = await supabase
    .from("pacing_plans")
    .update(updates)
    .eq("id", planId)
    .eq("teacher_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("pacing_plans")
    .delete()
    .eq("id", planId)
    .eq("teacher_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
