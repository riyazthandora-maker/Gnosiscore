import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("id, question_ids, is_published")
    .eq("id", id)
    .eq("creator_id", user.id)
    .single()

  if (testErr || !test) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (test.is_published) return NextResponse.json({ error: "Test is already published." }, { status: 409 })

  const questionIds = test.question_ids as string[]
  if (questionIds.length === 0) {
    return NextResponse.json({ error: "Cannot finalize a test with no questions." }, { status: 400 })
  }

  // Mark all questions as approved
  const { error: qErr } = await supabase
    .from("questions")
    .update({ status: "approved" })
    .in("id", questionIds)
    .eq("owner_id", user.id)

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Publish the test
  const { data: published, error: pubErr } = await supabase
    .from("tests")
    .update({ is_published: true })
    .eq("id", id)
    .select("id, title, question_ids, is_published")
    .single()

  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 })

  return NextResponse.json({ test: published })
}
