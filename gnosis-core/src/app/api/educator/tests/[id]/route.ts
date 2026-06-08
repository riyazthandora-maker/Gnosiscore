import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: test, error } = await supabase
    .from("tests")
    .select("*")
    .eq("id", id)
    .eq("creator_id", user.id)
    .single()

  if (error || !test) return NextResponse.json({ error: "Not found." }, { status: 404 })

  // Fetch the questions in order
  const { data: questions } = test.question_ids.length
    ? await supabase
        .from("questions")
        .select("id, question_text, options, explanation, difficulty, topic_tags, status")
        .in("id", test.question_ids)
    : { data: [] }

  // Preserve ordering from question_ids array
  const ordered = (test.question_ids as string[])
    .map((qid: string) => questions?.find((q) => q.id === qid))
    .filter(Boolean)

  return NextResponse.json({ test: { ...test, questions: ordered } })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: existing } = await supabase
    .from("tests")
    .select("id")
    .eq("id", id)
    .eq("creator_id", user.id)
    .single()

  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const body = await request.json() as {
    title?: string
    description?: string
    question_ids?: string[]
    time_limit_min?: number | null
    is_published?: boolean
  }

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title.trim()
  if (body.description !== undefined) update.description = body.description?.trim() ?? null
  if (body.question_ids !== undefined) update.question_ids = body.question_ids
  if (body.time_limit_min !== undefined) update.time_limit_min = body.time_limit_min
  if (body.is_published !== undefined) update.is_published = body.is_published

  const { data: test, error } = await supabase
    .from("tests")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ test })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", id)
    .eq("creator_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
