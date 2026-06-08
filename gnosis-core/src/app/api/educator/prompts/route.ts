import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("generation_requests")
    .select("prompt_context")
    .eq("requested_by", user.id)
    .not("prompt_context", "is", null)
    .order("created_at", { ascending: false })
    .limit(60)

  const seen = new Set<string>()
  const prompts: string[] = []
  for (const row of data ?? []) {
    const p = (row.prompt_context as string | null)?.trim()
    if (p && !seen.has(p)) {
      seen.add(p)
      prompts.push(p)
      if (prompts.length >= 20) break
    }
  }

  return NextResponse.json({ prompts })
}
