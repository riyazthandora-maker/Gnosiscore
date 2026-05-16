import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: configs, error } = await supabase
    .from("test_configs")
    .select("*, documents(id, title, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 })

  return NextResponse.json({ configs: configs ?? [] })
}
