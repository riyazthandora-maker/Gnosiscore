import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEoiAlertToTeacher } from "@/lib/email/send-eoi-alert"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const adminDb = createAdminClient()

  // Find the student's walk-in roster entry
  const { data: entries } = await adminDb
    .from("student_roster")
    .select("id, teacher_id, name, email")
    .eq("student_user_id", user.id)
    .eq("is_walkin", true)
    .is("eoi_at", null)

  if (!entries || entries.length === 0) {
    // Already submitted or not walk-in — return silently
    return NextResponse.json({ ok: true })
  }

  const rosterIds = entries.map((e) => e.id as string)

  // Mark EOI submitted
  await adminDb
    .from("student_roster")
    .update({ eoi_at: new Date().toISOString() })
    .in("id", rosterIds)

  // Fetch student profile for email
  const { data: profile } = await adminDb
    .from("users")
    .select("full_name, grade")
    .eq("id", user.id)
    .single()

  const studentName = (profile?.full_name as string) ?? entries[0].name as string ?? "Unknown"
  const studentEmail = entries[0].email as string
  const studentGrade = (profile?.grade as string) ?? ""

  // Notify each unique teacher
  const teacherIds = [...new Set(entries.map((e) => e.teacher_id as string))]
  for (const teacherId of teacherIds) {
    const { data: teacher } = await adminDb
      .from("users")
      .select("email")
      .eq("id", teacherId)
      .single()

    if (teacher?.email) {
      sendEoiAlertToTeacher({
        teacherEmail: teacher.email as string,
        studentName,
        studentEmail,
        studentGrade,
      }).catch((err: unknown) => console.error("[eoi] teacher email failed:", (err as Error)?.message))
    }
  }

  return NextResponse.json({ ok: true })
}

// GET — check if student has a walk-in roster entry and EOI status
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: entry } = await supabase
    .from("student_roster")
    .select("is_walkin, eoi_at")
    .eq("student_user_id", user.id)
    .eq("is_walkin", true)
    .maybeSingle()

  return NextResponse.json({
    is_walkin: !!entry,
    eoi_submitted: !!entry?.eoi_at,
  })
}
