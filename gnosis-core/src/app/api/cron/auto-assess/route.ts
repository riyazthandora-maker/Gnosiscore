import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAutoExam } from "@/lib/pacing/generate-auto-exam"
import { sendAutoExamReviewEmail } from "@/lib/email/send-auto-exam-review"
import { notify } from "@/lib/notifications/notify"
import type { DifficultyBands } from "@/types"

interface FlatBlock { id: string; level: string; text: string }

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: pending, error: rpcError } = await admin
    .rpc("get_pending_auto_assess_milestones", { p_days_ahead: 6 })

  if (rpcError) {
    console.error("[auto-assess cron] RPC error:", rpcError.message)
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  if (!pending?.length) {
    return NextResponse.json({ processed: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const results: { milestoneId: string; status: "generated" | "error"; error?: string }[] = []

  for (const row of pending) {
    try {
      const { data: book } = await admin
        .from("books")
        .select("blocks")
        .eq("id", row.book_id)
        .single()

      if (!book) {
        results.push({ milestoneId: row.milestone_id, status: "error", error: "Book not found" })
        continue
      }

      const { paperId } = await generateAutoExam({
        planId:          row.plan_id,
        milestoneId:     row.milestone_id,
        nodeId:          row.node_id,
        nodeTitle:       row.node_title,
        teacherId:       row.teacher_id,
        gradeId:         row.grade_id,
        blocks:          (book.blocks ?? []) as FlatBlock[],
        questionCount:   row.auto_question_count ?? 5,
        durationMinutes: row.auto_duration_minutes ?? 10,
        difficultyBands: (row.difficulty_bands ?? { low: [60, 70], medium: [70, 80], high: [80, 100] }) as DifficultyBands,
      })

      await admin.from("pacing_events").insert({
        plan_id:      row.plan_id,
        event_type:   "auto_exam_generated",
        payload:      { milestone_id: row.milestone_id, paper_id: paperId, node_id: row.node_id },
        triggered_by: "cron",
      })

      await notify({
        userId:  row.teacher_id,
        type:    "auto_exam_ready",
        payload: { plan_id: row.plan_id, milestone_id: row.milestone_id, paper_id: paperId },
      })

      const { data: teacher } = await admin
        .from("users")
        .select("email, full_name")
        .eq("id", row.teacher_id)
        .single()

      const { data: plan } = await admin
        .from("pacing_plans")
        .select("title")
        .eq("id", row.plan_id)
        .single()

      if (teacher?.email) {
        sendAutoExamReviewEmail({
          teacherEmail: teacher.email as string,
          teacherName:  (teacher.full_name as string) || "Teacher",
          chapterTitle: row.node_title,
          planTitle:    (plan?.title as string) ?? "",
          reviewUrl:    `${appUrl}/exams/pacing/${row.plan_id}`,
        }).catch((e: Error) => console.error("[auto-assess cron] email error:", e.message))
      }

      results.push({ milestoneId: row.milestone_id, status: "generated" })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[auto-assess cron] milestone ${row.milestone_id}:`, msg)
      results.push({ milestoneId: row.milestone_id, status: "error", error: msg })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
