import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("exam_papers")
    .select("id, title, created_at, questions")
    .eq("id", id)
    .eq("teacher_id", user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    id: data.id,
    title: data.title,
    created_at: data.created_at,
    questions: data.questions,
    question_count: Array.isArray(data.questions) ? data.questions.length : 0,
  })
}
