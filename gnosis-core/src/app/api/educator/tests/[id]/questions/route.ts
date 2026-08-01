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
    .select("question_ids, is_published, title")
    .eq("id", id)
    .eq("creator_id", user.id)
    .single()

  if (error || !test) return NextResponse.json({ error: "Not found." }, { status: 404 })

  if (!test.question_ids.length) {
    return NextResponse.json({ questions: [], is_published: test.is_published, title: test.title })
  }

  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id, question_text, options, explanation, difficulty, difficulty_weight, topic_tags, status")
    .in("id", test.question_ids)

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  const ordered = (test.question_ids as string[])
    .map((qid) => questions?.find((q) => q.id === qid))
    .filter(Boolean)

  return NextResponse.json({ questions: ordered, is_published: test.is_published, title: test.title })
}
