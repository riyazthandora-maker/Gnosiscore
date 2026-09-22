import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { password } = await request.json() as { password: string }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const adminDb = createAdminClient()

  const { data: target } = await adminDb.from("users").select("role, email").eq("id", targetId).single()
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })
  if (target.role !== "educator_parent") {
    return NextResponse.json({ error: "Password reset is only available for teacher accounts." }, { status: 400 })
  }

  const { error } = await adminDb.auth.admin.updateUserById(targetId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
