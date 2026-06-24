import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// Called by Vercel Cron every Monday at 00:00 UTC.
// Secured with CRON_SECRET so it can't be triggered publicly.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminDb = createAdminClient()
  const { error } = await adminDb.rpc("reset_all_educator_tokens")

  if (error) {
    console.error("[cron/reset-tokens] error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[cron/reset-tokens] educator tokens reset at", new Date().toISOString())
  return NextResponse.json({ ok: true, reset_at: new Date().toISOString() })
}
