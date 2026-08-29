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

  // Verify the logged-in user is a student
  const { data: profile } = await adminDb
    .from("users")
    .select("role, email")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "student") {
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
  if (entry.email.toLowerCase() !== (profile.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address. Please log in with the correct account." },
      { status: 403 }
    )
  }

  // Check if already linked to this teacher
  const { data: existingLink } = await adminDb
    .from("educator_students")
    .select("id")
    .eq("educator_id", entry.teacher_id)
    .eq("student_id", user.id)
    .maybeSingle()

  if (!existingLink) {
    await adminDb
      .from("educator_students")
      .insert({ educator_id: entry.teacher_id, student_id: user.id })
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
