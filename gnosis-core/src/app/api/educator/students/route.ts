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

// GET /api/educator/students
// ?view=roster  → returns student_roster entries (student management page)
// default       → returns educator_students linked accounts (test assignment, backward compat)
export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get("view")

  // Legacy behavior for test assignment flows
  if (view !== "roster") {
    const { data: links } = await supabase
      .from("educator_students")
      .select("student_id")
      .eq("educator_id", user.id)

    if (!links || links.length === 0) return NextResponse.json({ students: [] })

    const studentIds = links.map((l) => l.student_id)
    const adminDb = createAdminClient()
    const { data: students } = await adminDb
      .from("users")
      .select("id, email, full_name")
      .in("id", studentIds)
      .order("full_name", { ascending: true })

    return NextResponse.json({ students: students ?? [] })
  }

  // Roster view — for student management page
  const search = searchParams.get("search")?.trim() ?? ""
  const gradeId = searchParams.get("grade_id") ?? ""
  const status = searchParams.get("status") ?? ""

  let query = supabase
    .from("student_roster")
    .select("id, teacher_id, student_user_id, name, email, phone, grade_id, grade:student_grades(id, name), status, invite_token, invite_expires_at, created_at, updated_at")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (gradeId) {
    query = query.eq("grade_id", gradeId)
  }
  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    console.error("[students GET roster]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ students: data ?? [] })
}

// POST /api/educator/students — create student + invite flow
export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    name?: string
    email?: string
    phone?: string
    grade_id?: string
    grade_name?: string
  }

  const name = body.name?.trim() ?? ""
  const email = body.email?.trim().toLowerCase() ?? ""
  const phone = body.phone?.trim() || null

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 })
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email address." }, { status: 400 })

  // Check for duplicate in this teacher's roster
  const { data: duplicate } = await supabase
    .from("student_roster")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("email", email)
    .maybeSingle()

  if (duplicate) {
    return NextResponse.json({ error: "A student with this email already exists in your roster." }, { status: 409 })
  }

  // Resolve grade — create inline if grade_name provided without grade_id
  let gradeId = body.grade_id ?? null
  if (body.grade_name?.trim() && !gradeId) {
    const { data: newGrade } = await supabase
      .from("student_grades")
      .insert({ teacher_id: user.id, name: body.grade_name.trim() })
      .select("id")
      .single()
    if (newGrade) gradeId = newGrade.id
  }

  const adminDb = createAdminClient()

  // Check if email already has an account
  const { data: existingUser } = await adminDb
    .from("users")
    .select("id, role")
    .eq("email", email)
    .maybeSingle()

  if (existingUser?.role === "student") {
    // Auto-link existing student account
    const { data: entry, error: insertErr } = await supabase
      .from("student_roster")
      .insert({
        teacher_id: user.id,
        student_user_id: existingUser.id,
        name,
        email,
        phone,
        grade_id: gradeId,
        status: "active",
      })
      .select("id, teacher_id, student_user_id, name, email, phone, grade_id, grade:student_grades(id, name), status, invite_token, invite_expires_at, created_at, updated_at")
      .single()

    if (insertErr) {
      console.error("[students POST auto-link]", insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    await adminDb
      .from("educator_students")
      .upsert(
        { educator_id: user.id, student_id: existingUser.id },
        { onConflict: "educator_id,student_id" }
      )

    return NextResponse.json({ student: entry, linked: true }, { status: 201 })
  }

  // New student — generate invite token + send email
  const inviteToken = generateToken()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: entry, error: insertErr } = await supabase
    .from("student_roster")
    .insert({
      teacher_id: user.id,
      name,
      email,
      phone,
      grade_id: gradeId,
      status: "invited",
      invite_token: inviteToken,
      invite_expires_at: expiresAt,
    })
    .select("id, teacher_id, student_user_id, name, email, phone, grade_id, grade:student_grades(id, name), status, invite_token, invite_expires_at, created_at, updated_at")
    .single()

  if (insertErr) {
    console.error("[students POST invite]", insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { data: teacherProfile } = await adminDb
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/student/${inviteToken}`

  sendStudentInviteEmail({
    studentEmail: email,
    studentName: name,
    teacherName: teacherProfile?.full_name || "Your teacher",
    inviteUrl,
    expiresAt,
  }).catch((err: unknown) => console.error("[students POST] invite email failed:", (err as Error)?.message))

  return NextResponse.json({ student: entry, invited: true }, { status: 201 })
}
