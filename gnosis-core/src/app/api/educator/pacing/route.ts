import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pacing_plans")
    .select(`
      id, title, academic_year, start_month, created_at,
      books ( id, title ),
      student_grades ( id, name ),
      pacing_milestones ( id )
    `)
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const plans = (data ?? []).map(p => ({
    ...p,
    milestone_count: Array.isArray(p.pacing_milestones) ? p.pacing_milestones.length : 0,
    pacing_milestones: undefined,
  }))

  return NextResponse.json({ plans })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, book_id, grade_id, academic_year, start_month } = await request.json()

  if (!title?.trim())   return NextResponse.json({ error: "Title is required." }, { status: 400 })
  if (!book_id)         return NextResponse.json({ error: "Book is required." }, { status: 400 })
  if (!grade_id)        return NextResponse.json({ error: "Grade is required." }, { status: 400 })
  if (!academic_year)   return NextResponse.json({ error: "Academic year is required." }, { status: 400 })
  if (!start_month || start_month < 1 || start_month > 12)
    return NextResponse.json({ error: "Valid start month is required." }, { status: 400 })

  const { data, error } = await supabase
    .from("pacing_plans")
    .insert({ teacher_id: user.id, title: title.trim(), book_id, grade_id, academic_year, start_month })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
