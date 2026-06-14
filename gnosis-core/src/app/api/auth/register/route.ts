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

  const { email, password, full_name, role, otpCode, otpToken } = await request.json()
  if (!email?.trim() || !role?.trim()) {
    return NextResponse.json({ error: "Email and role required." }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
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
  const userMeta = { full_name, role }

  if (IS_DEV) {
    const { error: createErr } = await supabase.auth.admin.createUser({
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

    return NextResponse.json({ success: true })
  }

  // Production — create confirmed user with their chosen password (no SMTP needed)
  const { error: createErr } = await supabase.auth.admin.createUser({
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

  return NextResponse.json({ success: true })
}
