import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAutoExamAssignedEmail } from "@/lib/email/send-auto-exam-assigned"
import { notify } from "@/lib/notifications/notify"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string; id: string }> }
) {
  const { planId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select("id, grade_id, title, auto_duration_minutes")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const { data: milestone } = await supabase
    .from("pacing_milestones")
    .select("id, node_title, auto_exam_paper_id, auto_exam_status")
    .eq("id", id)
    .eq("plan_id", planId)
    .single()

  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
  if (!milestone.auto_exam_paper_id) return NextResponse.json({ error: "No exam paper to approve" }, { status: 400 })
  if (milestone.auto_exam_status === "assigned") return NextResponse.json({ error: "Already assigned" }, { status: 409 })

  const admin = createAdminClient()

  const { data: rosterStudents } = await admin
    .from("student_roster")
    .select("id, name, email, student_user_id")
    .eq("grade_id", plan.grade_id as string)
    .eq("status", "active")

  if (!rosterStudents?.length) return NextResponse.json({ error: "No active students in grade" }, { status: 400 })

  const durationMinutes = (plan.auto_duration_minutes as number) ?? 10
  const rows = rosterStudents.map(s => ({
    paper_id:         milestone.auto_exam_paper_id,
    student_roster_id: s.id,
    assigned_by:      user.id,
    duration_minutes: durationMinutes,
    allow_backtrack:             true,
    flag_for_review:             true,
    release_results_immediately: true,
    show_explanations:           true,
    threshold_excellent:         90,
    threshold_distinction:       80,
    threshold_pass:              70,
  }))

  const { data: inserted, error: assignError } = await admin
    .from("exam_assignments")
    .upsert(rows, { onConflict: "paper_id,student_roster_id", ignoreDuplicates: false })
    .select("id, student_roster_id")

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  await admin
    .from("pacing_milestones")
    .update({ auto_exam_status: "assigned" })
    .eq("id", id)

  await admin.from("pacing_events").insert({
    plan_id:      planId,
    event_type:   "auto_exam_assigned",
    payload:      { milestone_id: id, paper_id: milestone.auto_exam_paper_id, student_count: inserted?.length ?? 0 },
    triggered_by: "teacher",
  })

  const { data: teacher } = await admin
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()
  const teacherName = (teacher?.full_name as string) || "Your teacher"

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const assignmentMap = Object.fromEntries(
    (inserted ?? []).map(a => [a.student_roster_id as string, a.id as string])
  )

  for (const student of rosterStudents) {
    const assignmentId = assignmentMap[student.id as string]
    if (!assignmentId) continue

    if (student.student_user_id) {
      notify({
        userId:  student.student_user_id as string,
        type:    "exam_assigned",
        payload: {
          assignment_id: assignmentId,
          paper_id:      milestone.auto_exam_paper_id,
          chapter_title: milestone.node_title,
          plan_id:       planId,
        },
      }).catch(() => {})
    }

    if (student.email) {
      sendAutoExamAssignedEmail({
        studentEmail: student.email as string,
        studentName:  student.name as string,
        teacherName,
        chapterTitle: milestone.node_title as string,
        lobbyUrl:     `${appUrl}/student/exam/${assignmentId}`,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ assigned: inserted?.length ?? 0, status: "assigned" })
}
