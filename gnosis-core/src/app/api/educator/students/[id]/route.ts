import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { sendStudentInviteEmail } from "@/lib/email/send-student-invite"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getEducator(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active")
    .eq("id", user.id)
    .single()
  if (
    profile?.role !== "educator_parent" ||
    profile.account_status !== "approved" ||
    profile.is_active === false
  ) return null
  return user
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

// PATCH /api/educator/students/[id] — update student details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    name?: string
    email?: string
    phone?: string
    grade_id?: string | null
    grade_name?: string
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 })
    updates.name = name
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email address." }, { status: 400 })

    // Check uniqueness (exclude current record)
    const { data: dup } = await supabase
      .from("student_roster")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("email", email)
      .neq("id", id)
      .maybeSingle()

    if (dup) return NextResponse.json({ error: "Another student with this email already exists in your roster." }, { status: 409 })
    updates.email = email
  }

  if (body.phone !== undefined) {
    updates.phone = body.phone.trim() || null
  }

  // Resolve grade
  if (body.grade_name?.trim() && body.grade_id === undefined) {
    const { data: newGrade } = await supabase
      .from("student_grades")
      .insert({ teacher_id: user.id, name: body.grade_name.trim() })
      .select("id")
      .single()
    if (newGrade) updates.grade_id = newGrade.id
  } else if ("grade_id" in body) {
    updates.grade_id = body.grade_id ?? null
  }

  const { data, error } = await supabase
    .from("student_roster")
    .update(updates)
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id, teacher_id, student_user_id, name, email, phone, grade_id, grade:student_grades(id, name), status, invite_token, invite_expires_at, created_at, updated_at")
    .single()

  if (error) {
    if (error.code === "PGRST116") return NextResponse.json({ error: "Student not found." }, { status: 404 })
    console.error("[students PATCH]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ student: data })
}

// DELETE /api/educator/students/[id] — remove from roster + unlink
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch the roster entry to get student_user_id
  const { data: entry } = await supabase
    .from("student_roster")
    .select("student_user_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Student not found." }, { status: 404 })

  const { error } = await supabase
    .from("student_roster")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id)

  if (error) {
    console.error("[students DELETE]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Unlink from educator_students if the student has an account
  if (entry.student_user_id) {
    const adminDb = createAdminClient()
    await adminDb
      .from("educator_students")
      .delete()
      .eq("educator_id", user.id)
      .eq("student_id", entry.student_user_id)
  }

  return NextResponse.json({ success: true })
}

// POST /api/educator/students/[id]/resend-invite — resend invite email
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: entry } = await supabase
    .from("student_roster")
    .select("name, email, status, teacher_id")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Student not found." }, { status: 404 })
  if (entry.status !== "invited") return NextResponse.json({ error: "Student has already joined." }, { status: 400 })

  const newToken = generateToken()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error: updateErr } = await supabase
    .from("student_roster")
    .update({ invite_token: newToken, invite_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", user.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const adminDb = createAdminClient()
  const { data: teacherProfile } = await adminDb
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/student/${newToken}`

  sendStudentInviteEmail({
    studentEmail: entry.email,
    studentName: entry.name,
    teacherName: teacherProfile?.full_name || "Your teacher",
    inviteUrl,
    expiresAt,
  }).catch((err: unknown) => console.error("[resend-invite] email failed:", (err as Error)?.message))

  return NextResponse.json({ success: true })
}
