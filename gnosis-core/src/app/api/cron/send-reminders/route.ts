import { createAdminClient } from "@/lib/supabase/admin"
import { sendTestReminderEmail } from "@/lib/email/send-test-reminder"
import { NextResponse } from "next/server"

// Called by Vercel Cron daily at 08:00 UTC.
// Sends reminder emails to students with pending (incomplete) assignments.
// Max 3 reminders per assignment, spaced at least 2 days apart.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminDb = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.ai"

  // Fetch assignments that need a reminder:
  // - fewer than 3 reminders sent
  // - never reminded OR last reminder was 2+ days ago
  // - deadline not yet passed (if set)
  // - student has not completed the test
  const { data: assignments, error } = await adminDb
    .from("test_assignments")
    .select(`
      id,
      test_id,
      student_id,
      assigned_by,
      due_at,
      ends_at,
      reminder_count,
      last_reminder_sent_at,
      tests ( title ),
      students:users!test_assignments_student_id_fkey ( email, full_name ),
      educators:users!test_assignments_assigned_by_fkey ( full_name )
    `)
    .lt("reminder_count", 3)
    .or("last_reminder_sent_at.is.null,last_reminder_sent_at.lt." + new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
    .or("ends_at.is.null,ends_at.gt." + new Date().toISOString())

  if (error) {
    console.error("[cron/send-reminders] fetch error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Filter out assignments where the student has already completed the test
  const testStudentPairs = assignments.map((a) => `${a.test_id}:${a.student_id}`)
  const uniqueTestIds = [...new Set(assignments.map((a) => a.test_id))]

  const { data: completedAttempts } = await adminDb
    .from("test_attempts")
    .select("test_id, student_id")
    .in("test_id", uniqueTestIds)
    .eq("status", "completed")

  const completedSet = new Set(
    (completedAttempts ?? []).map((a) => `${a.test_id}:${a.student_id}`)
  )

  const pending = assignments.filter(
    (a) => !completedSet.has(`${a.test_id}:${a.student_id}`)
  )

  let sent = 0

  await Promise.allSettled(
    pending.map(async (assignment) => {
      const studentRaw = assignment.students as unknown as { email: string; full_name: string | null }[] | null
      const educatorRaw = assignment.educators as unknown as { full_name: string | null }[] | null
      const testRaw = assignment.tests as unknown as { title: string }[] | null
      const student = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw
      const educator = Array.isArray(educatorRaw) ? educatorRaw[0] : educatorRaw
      const test = Array.isArray(testRaw) ? testRaw[0] : testRaw

      if (!student?.email || !test?.title) return

      const nextCount = (assignment.reminder_count ?? 0) + 1
      const reminderNumber = nextCount as 1 | 2 | 3

      try {
        await sendTestReminderEmail({
          studentEmail: student.email,
          studentName: student.full_name ?? student.email,
          testTitle: test.title,
          educatorName: educator?.full_name ?? "Your teacher",
          dueAt: assignment.due_at ?? assignment.ends_at ?? null,
          testUrl: `${appUrl}/student/tests/${assignment.test_id}`,
          reminderNumber,
        })

        await adminDb
          .from("test_assignments")
          .update({
            reminder_count: nextCount,
            last_reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", assignment.id)

        sent++
      } catch (err) {
        console.error(`[cron/send-reminders] failed for assignment ${assignment.id}:`, (err as Error)?.message)
      }
    })
  )

  console.log(`[cron/send-reminders] sent ${sent} reminders at`, new Date().toISOString())
  return NextResponse.json({ ok: true, sent })
}
