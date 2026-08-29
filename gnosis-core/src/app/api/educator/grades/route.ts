import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function getEducator(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active")
    .eq("id", user.id)
    .single()
  if (
    profile?.role !== "educator_parent" ||
    profile.account_status !== "approved" ||
    profile.is_active === false
  ) return null
  return user
}

export async function GET(request: Request) {
  void request
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: grades, error } = await supabase
    .from("student_grades")
    .select("id, name, created_at")
    .eq("teacher_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    console.error("[grades GET]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ grades: grades ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as { name?: string }
  const name = body.name?.trim() ?? ""

  if (!name) return NextResponse.json({ error: "Grade name is required." }, { status: 400 })
  if (name.length > 80) return NextResponse.json({ error: "Grade name must be 80 characters or fewer." }, { status: 400 })

  const { data, error } = await supabase
    .from("student_grades")
    .insert({ teacher_id: user.id, name })
    .select("id, name, created_at")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A grade with this name already exists." }, { status: 409 })
    }
    console.error("[grades POST]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ grade: data }, { status: 201 })
}
