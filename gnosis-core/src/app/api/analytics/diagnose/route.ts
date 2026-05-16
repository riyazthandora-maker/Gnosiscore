import { createClient } from "@/lib/supabase/server"
import { generateDiagnostic } from "@/lib/ai/diagnostic-generator"
import { checkRateLimit, LIMITS } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import type { OverviewStats, TopicStat } from "@/app/api/analytics/route"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: report } = await supabase
    .from("diagnostic_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ report: report ?? null })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed, resetAt } = checkRateLimit(
    `diagnose:${user.id}`, LIMITS.diagnose.limit, LIMITS.diagnose.windowMs
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many reports generated. Try again after ${new Date(resetAt).toLocaleTimeString()}.` },
      { status: 429 }
    )
  }

  const { overview, topics }: { overview: OverviewStats; topics: TopicStat[] } = await request.json()

  let diagnostic
  try {
    diagnostic = await generateDiagnostic(overview, topics)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate report."
    return NextResponse.json({ error: message }, { status: 422 })
  }

  const { data: report, error } = await supabase
    .from("diagnostic_reports")
    .insert({
      user_id: user.id,
      strengths: diagnostic.strengths,
      weaknesses: diagnostic.weaknesses,
      raw_narrative: diagnostic.raw_narrative,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: "Failed to save report." }, { status: 500 })

  return NextResponse.json({ report }, { status: 201 })
}
