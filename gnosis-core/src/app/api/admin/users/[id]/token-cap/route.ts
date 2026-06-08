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

  const body = await request.json() as { token_cap: number | null }
  const { token_cap } = body

  if (token_cap !== null && (typeof token_cap !== "number" || !Number.isInteger(token_cap) || token_cap < 0)) {
    return NextResponse.json({ error: "token_cap must be a non-negative integer or null." }, { status: 400 })
  }

  const adminDb = createAdminClient()
  const { error } = await adminDb
    .from("users")
    .update({ token_cap: token_cap ?? null })
    .eq("id", id)
    .eq("role", "educator_parent")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, token_cap })
}
