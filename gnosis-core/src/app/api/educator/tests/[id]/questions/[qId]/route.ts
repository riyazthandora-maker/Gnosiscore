import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function getTestOwnership(supabase: Awaited<ReturnType<typeof createClient>>, testId: string, userId: string) {
  const { data: test, error } = await supabase
    .from("tests")
    .select("id, question_ids, is_published")
    .eq("id", testId)
    .eq("creator_id", userId)
    .single()
  if (error || !test) return null
  return test
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const { id, qId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const test = await getTestOwnership(supabase, id, user.id)
  if (!test) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (test.is_published) return NextResponse.json({ error: "Cannot edit a published test." }, { status: 409 })
  if (!(test.question_ids as string[]).includes(qId)) {
    return NextResponse.json({ error: "Question not in this test." }, { status: 404 })
  }

  const body = await request.json() as {
    question_text?: string
    options?: Array<{ label: string; text: string; is_correct: boolean }>
    explanation?: string
    difficulty_weight?: number
  }

  const update: Record<string, unknown> = {}
  if (body.question_text !== undefined) update.question_text = body.question_text.trim()
  if (body.options !== undefined) update.options = body.options
  if (body.explanation !== undefined) update.explanation = body.explanation?.trim() ?? null
  if (body.difficulty_weight !== undefined) {
    update.difficulty_weight = Math.max(0.1, Math.min(99.99, Number(body.difficulty_weight) || 1.0))
  }

  const { data: question, error } = await supabase
    .from("questions")
    .update(update)
    .eq("id", qId)
    .eq("owner_id", user.id)
    .select("id, question_text, options, explanation, difficulty, difficulty_weight, topic_tags, status")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const { id, qId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const test = await getTestOwnership(supabase, id, user.id)
  if (!test) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (test.is_published) return NextResponse.json({ error: "Cannot edit a published test." }, { status: 409 })

  const ids = test.question_ids as string[]
  if (!ids.includes(qId)) return NextResponse.json({ error: "Question not in this test." }, { status: 404 })

  // Remove from test's question_ids first
  const newIds = ids.filter((id) => id !== qId)
  const { error: updateErr } = await supabase
    .from("tests")
    .update({ question_ids: newIds })
    .eq("id", id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Delete the question record
  await supabase.from("questions").delete().eq("id", qId).eq("owner_id", user.id)

  return new NextResponse(null, { status: 204 })
}
