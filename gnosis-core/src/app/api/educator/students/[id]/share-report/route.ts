import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendStudentInsightsEmail } from "@/lib/email/send-student-insights"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? (user.user_metadata?.role as string | undefined)
  if (role !== "educator_parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Verify the student belongs to this teacher and get their email
  const { data: entry } = await supabase
    .from("student_roster")
    .select("name, email")
    .eq("teacher_id", user.id)
    .eq("student_user_id", studentId)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Student not linked to your account." }, { status: 403 })

  const body = await req.json()
  const { insights } = body as {
    insights: {
      exam_history: { test_title: string; pct: number; completed_at: string }[]
      topic_accuracy: { topic: string; accuracy_pct: number }[]
      score_trend: { pct: number }[]
      ai_advisory: string | null
    }
  }

  if (!insights) return NextResponse.json({ error: "No insights data provided." }, { status: 400 })

  const { exam_history, topic_accuracy, score_trend, ai_advisory } = insights

  const avgScore = exam_history.length
    ? Math.round(exam_history.reduce((s, e) => s + e.pct, 0) / exam_history.length)
    : null

  const trendDelta = score_trend.length >= 2
    ? score_trend[score_trend.length - 1].pct - score_trend[0].pct
    : null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  await sendStudentInsightsEmail({
    studentName: entry.name as string,
    studentEmail: entry.email as string,
    teacherName: (profile?.full_name as string) || "Your teacher",
    examsCount: exam_history.length,
    avgScore,
    trendDelta,
    aiAdvisory: ai_advisory,
    strongTopics: topic_accuracy.filter(t => t.accuracy_pct >= 70).slice(0, 4),
    weakTopics: topic_accuracy.filter(t => t.accuracy_pct < 60).slice(0, 4),
    examHistory: exam_history,
    reportUrl: `${appUrl}/analytics/students/${studentId}`,
  })

  return NextResponse.json({ ok: true })
}
