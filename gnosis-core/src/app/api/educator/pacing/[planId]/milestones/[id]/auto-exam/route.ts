import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAutoExam } from "@/lib/pacing/generate-auto-exam"
import type { DifficultyBands } from "@/types"

interface FlatBlock { id: string; level: string; text: string }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string; id: string }> }
) {
  const { planId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: milestone } = await supabase
    .from("pacing_milestones")
    .select("auto_exam_paper_id, auto_exam_status")
    .eq("id", id)
    .eq("plan_id", planId)
    .single()

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!milestone.auto_exam_paper_id) return NextResponse.json({ paper: null, status: null })

  const { data: paper } = await supabase
    .from("exam_papers")
    .select("id, title, questions, created_at")
    .eq("id", milestone.auto_exam_paper_id)
    .single()

  return NextResponse.json({ paper, status: milestone.auto_exam_status })
}

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
    .select("id, book_id, grade_id, auto_question_count, auto_duration_minutes, difficulty_bands")
    .eq("id", planId)
    .eq("teacher_id", user.id)
    .single()

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

  const { data: milestone } = await supabase
    .from("pacing_milestones")
    .select("id, node_id, node_title, auto_exam_paper_id")
    .eq("id", id)
    .eq("plan_id", planId)
    .single()

  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 })

  const admin = createAdminClient()

  // Fetch book separately with admin client — avoids PostgREST join ambiguity and RLS gaps
  const { data: book, error: bookError } = await admin
    .from("books")
    .select("blocks")
    .eq("id", plan.book_id as string)
    .single()

  if (bookError || !book) {
    console.error("[auto-exam manual] book fetch failed:", bookError?.message)
    return NextResponse.json({ error: "Could not load book content." }, { status: 500 })
  }

  if (milestone.auto_exam_paper_id) {
    await admin.from("exam_papers").delete().eq("id", milestone.auto_exam_paper_id)
    await admin.from("pacing_milestones").update({
      auto_exam_paper_id: null,
      auto_exam_status: null,
    }).eq("id", id)
  }

  try {
    const { paperId } = await generateAutoExam({
      planId,
      milestoneId:     milestone.id as string,
      nodeId:          milestone.node_id as string,
      nodeTitle:       milestone.node_title as string,
      teacherId:       user.id,
      gradeId:         plan.grade_id as string,
      blocks:          (book.blocks ?? []) as FlatBlock[],
      questionCount:   (plan.auto_question_count as number) ?? 5,
      durationMinutes: (plan.auto_duration_minutes as number) ?? 10,
      difficultyBands: (plan.difficulty_bands as DifficultyBands) ?? { low: [60, 70], medium: [70, 80], high: [80, 100] },
    })

    await admin.from("pacing_events").insert({
      plan_id:      planId,
      event_type:   "auto_exam_generated",
      payload:      { milestone_id: id, paper_id: paperId, node_id: milestone.node_id, triggered_by: "manual" },
      triggered_by: "teacher",
    })

    return NextResponse.json({ paperId, status: "pending_review" })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[auto-exam manual] generation failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
