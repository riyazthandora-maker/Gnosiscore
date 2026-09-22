import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PlanDetailClient } from "@/components/pacing/plan-detail-client"

export const metadata: Metadata = { title: "Pacing Plan" }

interface FlatBlock { id: string; level: string; text: string }

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: plan } = await supabase
    .from("pacing_plans")
    .select(`
      id, title, academic_year, start_month,
      auto_assess_enabled, difficulty_bands, auto_question_count, auto_duration_minutes,
      books ( id, title, blocks ),
      student_grades ( id, name ),
      pacing_milestones ( id, node_id, node_level, node_title, month, week_in_month, topic_notes, milestone_type, auto_exam_paper_id, auto_exam_status )
    `)
    .eq("id", planId)
    .eq("teacher_id", user!.id)
    .single()

  if (!plan) notFound()

  const bookData  = plan.books as unknown as { id: string; title: string; blocks: FlatBlock[] } | null
  const gradeData = plan.student_grades as unknown as { id: string; name: string } | null

  const defaultBands = { low: [60, 70] as [number,number], medium: [70, 80] as [number,number], high: [80, 100] as [number,number] }

  return (
    <PlanDetailClient
      plan={{
        id:                    plan.id as string,
        title:                 plan.title as string,
        academic_year:         plan.academic_year as string,
        start_month:           plan.start_month as number,
        book_title:            bookData?.title  ?? "—",
        grade_name:            gradeData?.name  ?? "—",
        blocks:                bookData?.blocks ?? [],
        auto_assess_enabled:   (plan.auto_assess_enabled as boolean) ?? false,
        difficulty_bands:      (plan.difficulty_bands as typeof defaultBands) ?? defaultBands,
        auto_question_count:   (plan.auto_question_count as number) ?? 5,
        auto_duration_minutes: (plan.auto_duration_minutes as number) ?? 10,
      }}
      initialMilestones={(plan.pacing_milestones ?? []) as {
        id: string
        node_id: string
        node_level: string
        node_title: string
        month: number
        week_in_month: number
        topic_notes: string | null
        milestone_type: "teach" | "revise" | "assess"
        auto_exam_paper_id: string | null
        auto_exam_status: string | null
      }[]}
    />
  )
}
