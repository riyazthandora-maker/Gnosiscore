import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAutoExam } from "@/lib/pacing/generate-auto-exam"
import type { DifficultyBands } from "@/types"

interface FlatBlock { id: string; level: string; text: string }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string; id: string }> }
) {
  const { planId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: milestone } = await supabase
    .from("pacing_milestones")
    .select("id, node_id, node_title, auto_exam_paper_id, auto_exam_status")
    .eq("id", id)
    .eq("plan_id", planId)
    .single()

  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
  if (milestone.auto_exam_status === "assigned") {
    return NextResponse.json({ error: "Already assigned to students — cannot regenerate" }, { status: 409 })
  }

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select(`
      id, grade_id,
      auto_question_count, auto_duration_minutes, difficulty_bands,
      books ( id, blocks )
    `)
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const admin = createAdminClient()

  if (milestone.auto_exam_paper_id) {
    await admin.from("exam_papers").delete().eq("id", milestone.auto_exam_paper_id)
    await admin.from("pacing_milestones").update({
      auto_exam_paper_id: null,
      auto_exam_status: null,
    }).eq("id", id)
  }

  const bookData = plan.books as unknown as { id: string; blocks: FlatBlock[] } | null

  const { paperId } = await generateAutoExam({
    planId,
    milestoneId: milestone.id as string,
    nodeId:      milestone.node_id as string,
    nodeTitle:   milestone.node_title as string,
    teacherId:   user.id,
    gradeId:     plan.grade_id as string,
    blocks:      bookData?.blocks ?? [],
    questionCount:   (plan.auto_question_count as number) ?? 5,
    durationMinutes: (plan.auto_duration_minutes as number) ?? 10,
    difficultyBands: (plan.difficulty_bands as DifficultyBands) ?? { low: [60, 70], medium: [70, 80], high: [80, 100] },
  })

  await admin.from("pacing_events").insert({
    plan_id:      planId,
    event_type:   "auto_exam_generated",
    payload:      { milestone_id: id, paper_id: paperId, node_id: milestone.node_id, regenerated: true },
    triggered_by: "teacher",
  })

  return NextResponse.json({ paperId, status: "pending_review" })
}
