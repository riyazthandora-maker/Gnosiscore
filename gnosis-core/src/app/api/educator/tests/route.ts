import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("tests")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tests: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent" || profile?.account_status !== "approved") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json() as {
    title: string
    description?: string
    question_ids: string[]
    time_limit_min?: number
    is_published?: boolean
  }

  const { title, description, question_ids, time_limit_min, is_published } = body

  if (!title?.trim()) return NextResponse.json({ error: "title is required." }, { status: 400 })
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return NextResponse.json({ error: "At least one question is required." }, { status: 400 })
  }

  // Verify educator owns all questions and they are approved
  const { data: qs } = await supabase
    .from("questions")
    .select("id")
    .in("id", question_ids)
    .eq("owner_id", user.id)
    .eq("status", "approved")

  if (!qs || qs.length !== question_ids.length) {
    return NextResponse.json({ error: "One or more questions not found or not approved." }, { status: 400 })
  }

  const { data: test, error } = await supabase
    .from("tests")
    .insert({
      creator_id: user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      question_ids,
      time_limit_min: time_limit_min ?? null,
      is_published: is_published ?? false,
    })
    .select()
    .single()

  if (error || !test) return NextResponse.json({ error: error?.message ?? "Failed to create test." }, { status: 500 })
  return NextResponse.json({ test }, { status: 201 })
}
