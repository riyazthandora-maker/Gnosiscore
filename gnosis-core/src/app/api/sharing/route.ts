import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: granted }, { data: received }] = await Promise.all([
    supabase
      .from("dashboard_shares")
      .select("id, granted_at, viewer:users!viewer_id(id, email, display_name, avatar_url)")
      .eq("owner_id", user.id)
      .order("granted_at", { ascending: false }),
    supabase
      .from("dashboard_shares")
      .select("id, granted_at, owner:users!owner_id(id, email, display_name, avatar_url)")
      .eq("viewer_id", user.id)
      .order("granted_at", { ascending: false }),
  ])

  return NextResponse.json({ granted: granted ?? [], received: received ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { email }: { email: string } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 })

  const normalised = email.trim().toLowerCase()
  if (normalised === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "You can't share your dashboard with yourself." }, { status: 400 })
  }

  // Look up the target user
  const { data: target } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalised)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: "No GnosisCore account found for that email address." }, { status: 404 })
  }

  // Upsert (silently ignore duplicates)
  const { error } = await supabase
    .from("dashboard_shares")
    .upsert({ owner_id: user.id, viewer_id: target.id }, { onConflict: "owner_id,viewer_id", ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: "Failed to grant access." }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
