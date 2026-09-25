import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// POST /api/invite/student/[token]/claim — authenticated student claims their invite
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  void request
  const { token } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "You must be logged in to claim this invite." }, { status: 401 })

  const adminDb = createAdminClient()

  // Verify the logged-in user is a student. Prefer the public.users profile row,
  // but fall back to auth metadata: students created while the
  // on_auth_user_created trigger was absent have no profile row
  // (see supabase/fix-users-trigger.sql).
  const { data: profile } = await adminDb
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role ?? (user.user_metadata?.role as string | undefined)
  const email = profile?.email ?? user.email ?? ""

  if (role !== "student") {
    return NextResponse.json({ error: "Only student accounts can claim class invites." }, { status: 403 })
  }

  // Fetch the roster entry
  const { data: entry } = await adminDb
    .from("student_roster")
    .select("id, teacher_id, email, status, invite_expires_at")
    .eq("invite_token", token)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Invite not found or already claimed." }, { status: 404 })

  if (entry.status === "active") return NextResponse.json({ error: "This invite has already been claimed." }, { status: 410 })
  if (entry.status === "archived") return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 })
  if (entry.invite_expires_at && new Date(entry.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired. Ask your teacher to resend it." }, { status: 410 })
  }

  // Email must match
  if (entry.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address. Please log in with the correct account." },
      { status: 403 }
    )
  }

  await adminDb
    .from("student_roster")
    .update({
      student_user_id: user.id,
      status: "active",
      invite_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entry.id)

  return NextResponse.json({ success: true })
}
