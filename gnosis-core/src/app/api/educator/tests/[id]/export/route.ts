import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: test } = await supabase
    .from("tests")
    .select("id, title, question_ids")
    .eq("id", testId)
    .eq("creator_id", user.id)
    .single()

  if (!test) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("student_id, score, max_score, answers, completed_at, users!student_id(full_name, email)")
    .eq("test_id", testId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })

  const rows: string[] = ["Student Name,Email,Score,Max Score,Percentage,Completed At"]

  for (const attempt of attempts ?? []) {
    const profile = attempt.users as unknown as { full_name: string; email: string }
    const pct = attempt.max_score && attempt.max_score > 0
      ? Math.round(((attempt.score ?? 0) / (attempt.max_score as number)) * 100)
      : 0
    const completedAt = attempt.completed_at
      ? new Date(attempt.completed_at).toISOString().replace("T", " ").substring(0, 16)
      : ""

    const name = (profile?.full_name ?? "").replace(/,/g, " ")
    const email = (profile?.email ?? "").replace(/,/g, " ")

    rows.push(`${name},${email},${attempt.score ?? 0},${attempt.max_score ?? 0},${pct}%,${completedAt}`)
  }

  const csv = rows.join("\n")
  const safeTitle = (test.title ?? "export").replace(/[^a-z0-9]/gi, "_").toLowerCase()

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${safeTitle}_results.csv"`,
    },
  })
}
