import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ExamQuestion, ExamSourceMeta } from "@/types"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, questions, source_meta }: {
    title: string
    questions: ExamQuestion[]
    source_meta: ExamSourceMeta
  } = await request.json()

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (!questions?.length) return NextResponse.json({ error: "No questions" }, { status: 400 })

  // Uniqueness check for this teacher
  const { count } = await supabase
    .from("exam_papers")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", user.id)
    .eq("title", title.trim())

  if (count && count > 0) {
    return NextResponse.json({ error: "You already have an exam with this title." }, { status: 409 })
  }

  const { data, error } = await supabase
    .from("exam_papers")
    .insert({
      teacher_id: user.id,
      title: title.trim(),
      questions,
      source_meta,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("exam_papers")
    .select("id, title, created_at, questions")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const exams = (data ?? []).map(e => ({
    id: e.id,
    title: e.title,
    created_at: e.created_at,
    question_count: Array.isArray(e.questions) ? e.questions.length : 0,
  }))

  return NextResponse.json({ exams })
}
