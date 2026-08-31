import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ExamController } from "@/components/student/exam-controller"
import type { ExamQuestion } from "@/types"

export default async function StudentExamPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Load assignment (RLS ensures student can only see their own)
  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .select("*, exam_papers(id, title, questions)")
    .eq("id", assignmentId)
    .single()

  if (error || !assignment) redirect("/student")

  // Load existing active session if any
  const { data: session } = await supabase
    .from("exam_sessions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("student_user_id", user.id)
    .in("status", ["lobby", "in_progress", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Count completed attempts
  const { count: completedCount } = await supabase
    .from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId)
    .eq("student_user_id", user.id)
    .in("status", ["submitted", "auto_submitted"])

  const attemptsDone = completedCount ?? 0

  // If attempt limit reached and no active session → redirect
  if (attemptsDone >= (assignment.max_attempts as number) && !session) {
    redirect("/student")
  }

  const paperData = assignment.exam_papers as { id: string; title: string; questions: ExamQuestion[] }

  return (
    <ExamController
      assignmentId={assignmentId}
      examTitle={paperData.title}
      questions={paperData.questions ?? []}
      existingSession={session as Record<string, unknown> | null}
      attemptNumber={attemptsDone + 1}
      config={{
        duration_minutes: assignment.duration_minutes as number,
        max_attempts: assignment.max_attempts as number,
        randomize_questions: assignment.randomize_questions as boolean,
        shuffle_answers: assignment.shuffle_answers as boolean,
        allow_backtrack: assignment.allow_backtrack as boolean,
        mandatory_answering: assignment.mandatory_answering as boolean,
        flag_for_review: assignment.flag_for_review as boolean,
        browser_lockdown: assignment.browser_lockdown as boolean,
        disable_copy_paste: assignment.disable_copy_paste as boolean,
        tab_switch_warnings: assignment.tab_switch_warnings as boolean,
        tab_switch_limit: assignment.tab_switch_limit as number,
        release_results_immediately: assignment.release_results_immediately as boolean,
        show_explanations: assignment.show_explanations as boolean,
        threshold_excellent: assignment.threshold_excellent as number,
        threshold_distinction: assignment.threshold_distinction as number,
        threshold_pass: assignment.threshold_pass as number,
      }}
    />
  )
}
