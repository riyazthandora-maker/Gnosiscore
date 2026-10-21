import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { sendAdminNewRegistrationAlert } from "@/lib/email/send-admin-alert"
import { verifyOtpToken } from "@/lib/otp-token"
import { sendStudentWelcomeEmail } from "@/lib/email/send-student-welcome"
import { sendWalkInAdminAlert } from "@/lib/email/send-walkin-admin-alert"

const ADMIN_TEACHER_EMAIL = "riyazkalla@gmail.com"

// Grade 1-4 → Primary, 5-7 → Upper Primary, 8-10 → High School, 11-12 → UG, rest → null
function gradeToTier(grade: string): string | null {
  const match = grade.match(/grade\s*(\d+)/i)
  if (match) {
    const n = parseInt(match[1], 10)
    if (n <= 4) return "Primary"
    if (n <= 7) return "Upper Primary"
    if (n <= 10) return "High School"
    return "UG"
  }
  return null
}

function isHigherEducation(grade: string): boolean {
  const g = grade.toLowerCase()
  return g === "degree" || g === "master" || g === "professional"
}

const IS_DEV = process.env.NODE_ENV === "development" ||
  !process.env.BACKEND_API_URL ||
  (process.env.BACKEND_API_URL ?? "").includes("localhost")


export async function POST(request: Request) {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? "unknown"
  const { allowed } = checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 })
  }

  const { email, password, full_name, role, otpCode, otpToken, contact, grade, subjects } = await request.json()
  if (!email?.trim() || !role?.trim()) {
    return NextResponse.json({ error: "Email and role required." }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }
  // Self-registration is limited to these two roles. Without this check a caller
  // could pass role: "admin" and be granted an approved admin account.
  if (role !== "student" && role !== "educator_parent") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }

  // Educator/parent registrations require email OTP verification
  if (role === "educator_parent") {
    if (!otpCode?.trim() || !otpToken?.trim()) {
      return NextResponse.json({ error: "Email verification required." }, { status: 400 })
    }
    if (!verifyOtpToken(email.trim().toLowerCase(), otpCode.trim(), otpToken.trim())) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 })
    }
  }

  const supabase = createAdminClient()
  const isStudent = role === "student"

  // Only students carry the extra contact/grade/subjects fields. They land in
  // user_metadata so the on_auth_user_created trigger can mirror them; the
  // ensureProfileRow upsert below covers the trigger-absent path.
  const studentFields = {
    whatsapp: isStudent ? asText(contact) : "",
    grade: isStudent ? asText(grade) : "",
    subjects: isStudent ? asText(subjects) : "",
  }
  const userMeta = {
    full_name,
    role,
    ...(isStudent
      ? {
          whatsapp: studentFields.whatsapp,
          grade: studentFields.grade,
          subjects: studentFields.subjects,
        }
      : {}),
  }

  if (IS_DEV) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      password,
      user_metadata: userMeta,
    })

    if (createErr) {
      if (!createErr.message.toLowerCase().includes("already")) {
        return NextResponse.json({ error: createErr.message }, { status: 400 })
      }
      // User already exists — find their ID and update password + metadata.
      // GoTrue's ?email= query param does not filter; we must search client-side.
      let userId: string | null = null

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", email.trim())
        .single()

      if (existing?.id) {
        userId = existing.id
      } else {
        // Orphaned auth user (trigger may have failed) — paginate listUsers to find by email
        let found = false
        let page = 1
        while (!found) {
          const { data } = await supabase.auth.admin.listUsers({ page, perPage: 50 })
          if (!data?.users?.length) break
          const match = data.users.find((u) => u.email === email.trim())
          if (match) { userId = match.id; found = true }
          if (data.users.length < 50) break
          page++
        }
      }

      if (!userId) {
        return NextResponse.json({ error: "Could not locate existing account. Please contact support." }, { status: 500 })
      }

      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: userMeta,
      })
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    if (!createErr && created?.user) {
      await ensureProfileRow(supabase, created.user.id, email.trim(), full_name, role, studentFields)
    }

    if (!createErr && role === "educator_parent") {
      const { data: adminUser } = await supabase.from("users").select("email").eq("role", "admin").limit(1).single()
      if (adminUser?.email) {
        sendAdminNewRegistrationAlert({
          adminEmail: adminUser.email,
          fullName: full_name ?? email.trim(),
          email: email.trim(),
        }).catch((err: unknown) => console.error("[register] admin alert failed:", (err as Error)?.message))
      }
    }

    // Auto-link any pending roster invites for this student email. Awaited —
    // the client signs in immediately after this response and would otherwise
    // reach the student area before the link (and promotion) landed.
    if (!createErr && role === "student") {
      await autoLinkRosterInvites(supabase, email.trim().toLowerCase()).catch(
        (err: unknown) => console.error("[register] roster auto-link failed:", (err as Error)?.message)
      )
    }

    const devHeld = await isHeldStudent(supabase, isStudent, email)

    if (!createErr && isStudent && devHeld) {
      const walkInResult = await handleWalkInStudent(
        supabase,
        email.trim().toLowerCase(),
        full_name ?? "",
        asText(grade),
      ).catch((err: unknown) => {
        console.error("[register] walk-in handling failed:", (err as Error)?.message)
        return null
      })
      return NextResponse.json({
        success: true,
        held: false,
        walkin: true,
        higherEd: walkInResult?.higherEd ?? false,
      })
    }

    return NextResponse.json({ success: true, held: devHeld })
  }

  // Production — create confirmed user with their chosen password (no SMTP needed)
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: email.trim(),
    email_confirm: true,
    password,
    user_metadata: userMeta,
  })

  if (createErr) {
    if (!createErr.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }
    // Existing user — update password and metadata
    let userId: string | null = null

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.trim())
      .single()

    if (existing?.id) {
      userId = existing.id
    } else {
      let found = false
      let page = 1
      while (!found) {
        const { data } = await supabase.auth.admin.listUsers({ page, perPage: 50 })
        if (!data?.users?.length) break
        const match = data.users.find((u) => u.email === email.trim())
        if (match) { userId = match.id; found = true }
        if (data.users.length < 50) break
        page++
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Could not locate existing account. Please contact support." }, { status: 500 })
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: userMeta,
    })
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  if (!createErr && created?.user) {
    await ensureProfileRow(supabase, created.user.id, email.trim(), full_name, role, studentFields)
  }

  if (!createErr && role === "educator_parent") {
    const { data: adminUser } = await supabase.from("users").select("email").eq("role", "admin").limit(1).single()
    if (adminUser?.email) {
      sendAdminNewRegistrationAlert({
        adminEmail: adminUser.email,
        fullName: full_name ?? email.trim(),
        email: email.trim(),
      }).catch((err: unknown) => console.error("[register] admin alert failed:", (err as Error)?.message))
    }
  }

  // Auto-link any pending roster invites for this student email. Awaited —
  // the client signs in immediately after this response and would otherwise
  // reach the student area before the link (and promotion) landed.
  if (!createErr && role === "student") {
    await autoLinkRosterInvites(supabase, email.trim().toLowerCase()).catch(
      (err: unknown) => console.error("[register] roster auto-link failed:", (err as Error)?.message)
    )
  }

  const held = await isHeldStudent(supabase, isStudent, email)

  // Walk-in student: not linked via invite → auto-assign to admin teacher
  if (!createErr && isStudent && held) {
    const walkInResult = await handleWalkInStudent(
      supabase,
      email.trim().toLowerCase(),
      full_name ?? "",
      asText(grade),
    ).catch((err: unknown) => {
      console.error("[register] walk-in handling failed:", (err as Error)?.message)
      return null
    })
    return NextResponse.json({
      success: true,
      held: false,
      walkin: true,
      higherEd: walkInResult?.higherEd ?? false,
    })
  }

  return NextResponse.json({ success: true, held })
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

// Whether the freshly-registered student is still parked in 'hold' (no educator
// linked their email). Read from the DB rather than inferred, so a re-register
// by an already-linked student is not misreported as held.
async function isHeldStudent(
  adminDb: ReturnType<typeof createAdminClient>,
  isStudent: boolean,
  email: string
): Promise<boolean> {
  if (!isStudent) return false
  const { data } = await adminDb
    .from("users")
    .select("account_status")
    .eq("email", email.trim())
    .single()
  return data?.account_status === "hold"
}

async function autoLinkRosterInvites(
  adminDb: ReturnType<typeof createAdminClient>,
  normalizedEmail: string
): Promise<void> {
  const { data: pending } = await adminDb
    .from("student_roster")
    .select("id")
    .eq("email", normalizedEmail)
    .eq("status", "invited")

  if (!pending || pending.length === 0) return

  const { data: newUser } = await adminDb
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .single()

  if (!newUser?.id) return

  for (const entry of pending) {
    await adminDb
      .from("student_roster")
      .update({
        student_user_id: newUser.id,
        status: "active",
        invite_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id)
  }

  // A linked student is no longer on hold. Guarded on 'hold' so we never
  // resurrect a rejected or deactivated account.
  await adminDb
    .from("users")
    .update({ account_status: "approved" })
    .eq("id", newUser.id)
    .eq("account_status", "hold")
}

// Defensive: the on_auth_user_created trigger normally creates this row, but it
// is dropped by supabase/reset.sql and only restored by
// supabase/fix-users-trigger.sql. Registration must not depend on that.
async function ensureProfileRow(
  adminDb: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  fullName: string | undefined,
  role: string,
  fields: { whatsapp: string; grade: string; subjects: string }
): Promise<void> {
  const { error } = await adminDb
    .from("users")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName ?? "",
        whatsapp: fields.whatsapp,
        grade: fields.grade,
        subjects: fields.subjects,
        role,
        account_status:
          role === "educator_parent" ? "pending" : role === "student" ? "hold" : "approved",
      },
      { onConflict: "id", ignoreDuplicates: true }
    )

  if (error) console.error("[register] profile row upsert failed:", error.message)
}

async function handleWalkInStudent(
  adminDb: ReturnType<typeof createAdminClient>,
  studentEmail: string,
  studentFullName: string,
  studentGrade: string,
): Promise<{ higherEd: boolean } | null> {
  const higherEd = isHigherEducation(studentGrade)
  const tier = gradeToTier(studentGrade)

  // Find the fixed admin teacher
  const { data: teacher } = await adminDb
    .from("users")
    .select("id, email")
    .eq("email", ADMIN_TEACHER_EMAIL)
    .single()

  if (!teacher?.id) {
    console.error("[walk-in] admin teacher not found:", ADMIN_TEACHER_EMAIL)
    return null
  }

  // Find student user record
  const { data: student } = await adminDb
    .from("users")
    .select("id")
    .eq("email", studentEmail)
    .single()

  if (!student?.id) {
    console.error("[walk-in] student user not found:", studentEmail)
    return null
  }

  // Create walk-in roster entry
  const { error: rosterErr } = await adminDb
    .from("student_roster")
    .insert({
      teacher_id: teacher.id,
      student_user_id: student.id,
      name: studentFullName || studentEmail,
      email: studentEmail,
      status: "active",
      is_walkin: true,
      grade_id: null,
      invite_token: null,
    })

  if (rosterErr) {
    console.error("[walk-in] roster insert failed:", rosterErr.message)
  }

  // Approve the student account
  await adminDb
    .from("users")
    .update({ account_status: "approved" })
    .eq("id", student.id)

  if (higherEd) {
    sendWalkInAdminAlert({
      teacherEmail: ADMIN_TEACHER_EMAIL,
      studentName: studentFullName || studentEmail,
      studentEmail,
      gradeLevel: studentGrade,
    }).catch((err: unknown) => console.error("[walk-in] higher-ed alert failed:", (err as Error)?.message))
    return { higherEd: true }
  }

  if (!tier) return { higherEd: false }

  // Find a grade-matched talent exam paper from the admin teacher
  const { data: papers } = await adminDb
    .from("exam_papers")
    .select("id, title")
    .eq("teacher_id", teacher.id)
    .ilike("title", `%${tier}%`)
    .limit(1)

  const paper = papers?.[0]
  if (!paper) {
    console.error("[walk-in] no talent exam found for tier:", tier)
    return { higherEd: false }
  }

  // Create an assignment for the student
  const { data: assignment, error: assignErr } = await adminDb
    .from("exam_assignments")
    .insert({
      paper_id: paper.id,
      student_roster_id: (await adminDb
        .from("student_roster")
        .select("id")
        .eq("student_user_id", student.id)
        .eq("is_walkin", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      ).data?.id,
      assigned_by: teacher.id,
      duration_minutes: 5,
      max_attempts: 1,
      randomize_questions: false,
      shuffle_answers: false,
      allow_backtrack: true,
      mandatory_answering: false,
      flag_for_review: false,
      browser_lockdown: false,
      disable_copy_paste: false,
      tab_switch_warnings: false,
      tab_switch_limit: 0,
      release_results_immediately: true,
      show_explanations: false,
      threshold_excellent: 90,
      threshold_distinction: 75,
      threshold_pass: 50,
    })
    .select("id")
    .single()

  if (assignErr || !assignment) {
    console.error("[walk-in] assignment insert failed:", assignErr?.message)
    return { higherEd: false }
  }

  // Generate magic link → /auth/callback?next=/student/exam/<assignmentId>
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const redirectTo = `${appUrl}/auth/callback?next=/student/exam/${assignment.id}`

  const { data: linkData, error: linkErr } = await adminDb.auth.admin.generateLink({
    type: "magiclink",
    email: studentEmail,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    console.error("[walk-in] magic link generation failed:", linkErr?.message)
    return { higherEd: false }
  }

  sendStudentWelcomeEmail({
    to: studentEmail,
    fullName: studentFullName || studentEmail,
    grade: studentGrade,
    magicLink: linkData.properties.action_link,
  }).catch((err: unknown) => console.error("[walk-in] welcome email failed:", (err as Error)?.message))

  return { higherEd: false }
}
