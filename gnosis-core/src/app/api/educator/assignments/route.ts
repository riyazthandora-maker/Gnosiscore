import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTestAssignedEmail } from "@/lib/email/send-test-assigned"
import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rows } = await supabase
    .from("test_assignments")
    .select("test_id, student_id, time_limit_minutes, show_timer, show_answer_key, allow_retake, starts_at, ends_at, assigned_at")
    .eq("assigned_by", user.id)
    .order("assigned_at", { ascending: false })

  if (!rows?.length) return NextResponse.json({ assignments: [] })

  const testIds = [...new Set(rows.map((r) => r.test_id))]
  const { data: tests } = await supabase
    .from("tests")
    .select("id, title, question_ids")
    .in("id", testIds)

  const testMap = new Map((tests ?? []).map((t) => [t.id, t]))
  const now = new Date()

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    if (!grouped.has(row.test_id)) grouped.set(row.test_id, [])
    grouped.get(row.test_id)!.push(row)
  }

  const assignments = Array.from(grouped.entries()).map(([testId, testRows]) => {
    const first = testRows[0]
    const test = testMap.get(testId)

    let status: "upcoming" | "active" | "expired"
    if (first.ends_at && new Date(first.ends_at) < now) {
      status = "expired"
    } else if (first.starts_at && new Date(first.starts_at) > now) {
      status = "upcoming"
    } else {
      status = "active"
    }

    return {
      test_id: testId,
      test_title: test?.title ?? "Unknown",
      question_count: (test?.question_ids as string[])?.length ?? 0,
      student_count: testRows.length,
      time_limit_minutes: first.time_limit_minutes,
      show_timer: first.show_timer,
      show_answer_key: first.show_answer_key,
      allow_retake: first.allow_retake,
      starts_at: first.starts_at,
      ends_at: first.ends_at,
      assigned_at: first.assigned_at,
      status,
    }
  })

  return NextResponse.json({ assignments })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    test_id: string
    emails: string[]
    time_limit_minutes?: number
    show_timer?: boolean
    show_answer_key?: boolean
    allow_retake?: boolean
    starts_at?: string
    ends_at?: string
  }

  const {
    test_id, emails,
    time_limit_minutes = 20,
    show_timer = true,
    show_answer_key = true,
    allow_retake = true,
    starts_at,
    ends_at,
  } = body

  if (!test_id) return NextResponse.json({ error: "test_id is required." }, { status: 400 })
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails array is required." }, { status: 400 })
  }
  if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 })
  }

  const { data: test } = await supabase
    .from("tests")
    .select("id, title, is_published")
    .eq("id", test_id)
    .eq("creator_id", user.id)
    .single()

  if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 })

  const adminDb = createAdminClient()
  const cleaned = emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  const { data: students } = await adminDb
    .from("users")
    .select("id, email, full_name")
    .in("email", cleaned)
    .eq("role", "student")

  const foundEmails = new Set((students ?? []).map((s) => s.email))
  const notFound = cleaned.filter((e) => !foundEmails.has(e))

  if (!students?.length) {
    return NextResponse.json({ assigned: 0, not_found: notFound, message: "No matching student accounts found." })
  }

  await supabase.from("educator_students").upsert(
    students.map((s) => ({ educator_id: user.id, student_id: s.id })),
    { onConflict: "educator_id,student_id" }
  )

  if (!test.is_published) {
    await supabase.from("tests").update({ is_published: true }).eq("id", test_id)
  }

  const { error } = await supabase
    .from("test_assignments")
    .upsert(
      students.map((s) => ({
        test_id,
        student_id: s.id,
        assigned_by: user.id,
        time_limit_minutes,
        show_timer,
        show_answer_key,
        allow_retake,
        starts_at: starts_at ?? null,
        ends_at: ends_at ?? null,
        due_at: ends_at ?? null,
      })),
      { onConflict: "test_id,student_id" }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gnosiscore.org"
  const { data: educatorProfile } = await adminDb
    .from("users").select("full_name").eq("id", user.id).single()
  const educatorName = educatorProfile?.full_name ?? "Your teacher"

  waitUntil(
    Promise.all(
      students.map((student) =>
        sendTestAssignedEmail({
          studentEmail: student.email,
          studentName: student.full_name ?? student.email,
          educatorName,
          testTitle: test.title,
          testUrl: `${appUrl}/student/test/${test_id}`,
          dueAt: ends_at ?? null,
        }).catch((err) => console.error("[assign] email failed for", student.email, err?.message))
      )
    )
  )

  return NextResponse.json({ assigned: students.length, not_found: notFound })
}
