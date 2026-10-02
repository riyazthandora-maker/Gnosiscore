import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { sendAdminNewRegistrationAlert } from "@/lib/email/send-admin-alert"
import { verifyOtpToken } from "@/lib/otp-token"

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

    return NextResponse.json({ success: true, held: await isHeldStudent(supabase, isStudent, email) })
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

  return NextResponse.json({ success: true, held: await isHeldStudent(supabase, isStudent, email) })
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
