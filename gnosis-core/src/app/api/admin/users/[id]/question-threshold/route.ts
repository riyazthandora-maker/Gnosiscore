import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as { question_approval_threshold: number | null }
  const { question_approval_threshold: threshold } = body

  if (
    threshold !== null &&
    (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold < 1)
  ) {
    return NextResponse.json(
      { error: "question_approval_threshold must be a positive integer or null." },
      { status: 400 }
    )
  }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from("users")
    .update({ question_approval_threshold: threshold ?? null })
    .eq("id", id)
    .eq("role", "educator_parent")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, question_approval_threshold: threshold })
}
