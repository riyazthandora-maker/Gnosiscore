import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { QuestionStatus } from "@/types"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const summary = searchParams.get("summary") === "1"
  const status = searchParams.get("status") as QuestionStatus | null

  if (summary) {
    const [approvedRes, totalRes] = await Promise.all([
      supabase
        .from("questions")
        .select("id, question_text, difficulty, topic_tags, created_at, generation_request_id")
        .eq("owner_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
    ])

    const questions = approvedRes.data ?? []
    const genIds = [...new Set(questions.map((q) => q.generation_request_id).filter(Boolean))]

    const generationsRes = genIds.length > 0
      ? await supabase
          .from("generation_requests")
          .select("id, name, created_at")
          .in("id", genIds)
          .order("created_at", { ascending: false })
      : { data: [] }

    return NextResponse.json({
      questions,
      total: totalRes.count ?? 0,
      generations: generationsRes.data ?? [],
    })
  }

  const query = supabase
    .from("questions")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  if (status) query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    id: string
    action: "approve" | "reject"
    edits?: {
      question_text?: string
      options?: { label: string; text: string; is_correct: boolean }[]
      explanation?: string
    }
  }

  const { id, action, edits } = body
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve|reject) are required." }, { status: 400 })
  }

  // Verify ownership
  const { data: q } = await supabase
    .from("questions")
    .select("id, status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single()

  if (!q) return NextResponse.json({ error: "Question not found." }, { status: 404 })

  const update: Record<string, unknown> = {
    status: action === "approve" ? "approved" : "rejected",
    reviewed_at: new Date().toISOString(),
  }
  if (edits?.question_text) update.question_text = edits.question_text
  if (edits?.options) update.options = edits.options
  if (edits?.explanation !== undefined) update.explanation = edits.explanation

  const { error } = await supabase.from("questions").update(update).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
