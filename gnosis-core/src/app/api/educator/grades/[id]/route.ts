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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as { name?: string }
  const name = body.name?.trim() ?? ""

  if (!name) return NextResponse.json({ error: "Grade name is required." }, { status: 400 })
  if (name.length > 80) return NextResponse.json({ error: "Grade name must be 80 characters or fewer." }, { status: 400 })

  const { data, error } = await supabase
    .from("student_grades")
    .update({ name })
    .eq("id", id)
    .eq("teacher_id", user.id)
    .select("id, name, created_at")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A grade with this name already exists." }, { status: 409 })
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Grade not found." }, { status: 404 })
    }
    console.error("[grades PATCH]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ grade: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Block deletion if students are assigned to this grade
  const { count } = await supabase
    .from("student_roster")
    .select("id", { count: "exact", head: true })
    .eq("grade_id", id)
    .eq("teacher_id", user.id)
    .neq("status", "archived")

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} student${count > 1 ? "s are" : " is"} assigned to this grade.` },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from("student_grades")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id)

  if (error) {
    console.error("[grades DELETE]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
