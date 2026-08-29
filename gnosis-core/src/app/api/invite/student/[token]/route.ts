import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// GET /api/invite/student/[token] — public: validate token and return invite details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  void request
  const { token } = await params
  if (!token) return NextResponse.json({ error: "Invalid invite link." }, { status: 400 })

  const adminDb = createAdminClient()

  const { data: entry } = await adminDb
    .from("student_roster")
    .select("id, name, email, grade_id, grade:student_grades(name), status, invite_expires_at, teacher_id")
    .eq("invite_token", token)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Invite not found or already claimed." }, { status: 404 })

  if (entry.status === "active") {
    return NextResponse.json({ error: "This invite has already been claimed." }, { status: 410 })
  }

  if (entry.status === "archived") {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 })
  }

  if (entry.invite_expires_at && new Date(entry.invite_expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired. Ask your teacher to resend it." }, { status: 410 })
  }

  const { data: teacher } = await adminDb
    .from("users")
    .select("full_name")
    .eq("id", entry.teacher_id)
    .single()

  return NextResponse.json({
    invite: {
      studentName: entry.name,
      studentEmail: entry.email,
      gradeName: (entry.grade as { name?: string } | null)?.name ?? null,
      teacherName: teacher?.full_name ?? "Your teacher",
      expiresAt: entry.invite_expires_at,
    },
  })
}
