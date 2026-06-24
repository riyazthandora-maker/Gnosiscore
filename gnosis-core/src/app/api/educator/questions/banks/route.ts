import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Returns completed generation requests (question banks) with approved question counts per bank.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: requests, error } = await supabase
    .from("generation_requests")
    .select("id, name, question_count, status, created_at")
    .eq("requested_by", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!requests || requests.length === 0) {
    return NextResponse.json({ requests: [], approved_counts: {} })
  }

  // Count approved questions per generation request
  const { data: counts } = await supabase
    .from("questions")
    .select("generation_request_id")
    .in("generation_request_id", requests.map((r) => r.id))
    .eq("owner_id", user.id)
    .eq("status", "approved")

  const approvedCounts: Record<string, number> = {}
  for (const row of counts ?? []) {
    if (row.generation_request_id) {
      approvedCounts[row.generation_request_id] = (approvedCounts[row.generation_request_id] ?? 0) + 1
    }
  }

  return NextResponse.json({ requests, approved_counts: approvedCounts })
}
