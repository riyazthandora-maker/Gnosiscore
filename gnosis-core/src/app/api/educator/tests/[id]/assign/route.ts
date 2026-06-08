import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTestAssignedEmail } from "@/lib/email/send-test-assigned"
import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify educator owns the test
  const { data: test } = await supabase
    .from("tests")
    .select("id, title, is_published")
    .eq("id", testId)
    .eq("creator_id", user.id)
    .single()

  if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 })

  const body = await request.json() as { emails: string[]; due_at?: string }
  const { emails, due_at } = body

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array is required." }, { status: 400 })
  }

  const cleaned = emails.map((e) => e.trim().toLowerCase()).filter(Boolean)

  // Look up students by email — use admin client to bypass users_self RLS policy
  const adminDb = createAdminClient()
  const { data: students } = await adminDb
    .from("users")
    .select("id, email, full_name")
    .in("email", cleaned)
    .eq("role", "student")

  const foundEmails = new Set((students ?? []).map((s) => s.email))
  const notFound = cleaned.filter((e) => !foundEmails.has(e))

  if (!students || students.length === 0) {
    return NextResponse.json({
      assigned: 0,
      not_found: notFound,
      message: "No matching student accounts found.",
    })
  }

  // Upsert educator→student links for any new students
  const links = students.map((s) => ({
    educator_id: user.id,
    student_id: s.id,
  }))
  await supabase.from("educator_students").upsert(links, { onConflict: "educator_id,student_id" })

  // Publish the test if not already
  if (!test.is_published) {
    await supabase.from("tests").update({ is_published: true }).eq("id", testId)
  }

  // Create assignments (skip duplicates)
  const assignments = students.map((s) => ({
    test_id: testId,
    student_id: s.id,
    assigned_by: user.id,
    due_at: due_at ?? null,
  }))

  const { error } = await supabase
    .from("test_assignments")
    .upsert(assignments, { onConflict: "test_id,student_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send assignment emails — keep function alive until all emails are sent
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
  const { data: educatorProfile } = await adminDb
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()
  const educatorName = educatorProfile?.full_name ?? "Your teacher"

  waitUntil(
    Promise.all(
      students.map((student) =>
        sendTestAssignedEmail({
          studentEmail: student.email,
          studentName: student.full_name ?? student.email,
          educatorName,
          testTitle: test.title,
          testUrl: `${appUrl}/student/test/${testId}`,
          dueAt: due_at ?? null,
        }).catch((err) => console.error("[assign] email failed for", student.email, err?.message))
      )
    )
  )

  return NextResponse.json({
    assigned: students.length,
    not_found: notFound,
  })
}
