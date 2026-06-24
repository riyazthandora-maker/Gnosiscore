import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { is_active } = await request.json() as { is_active: boolean }
  if (typeof is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean." }, { status: 400 })
  }

  const adminDb = createAdminClient()

  // Only educators can be toggled
  const { data: target } = await adminDb
    .from("users")
    .select("role, full_name, email")
    .eq("id", targetId)
    .single()

  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })
  if (target.role !== "educator_parent") {
    return NextResponse.json({ error: "Only educator accounts can be activated or deactivated." }, { status: 400 })
  }

  const { error } = await adminDb
    .from("users")
    .update({ is_active })
    .eq("id", targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: targetId, is_active })
}
