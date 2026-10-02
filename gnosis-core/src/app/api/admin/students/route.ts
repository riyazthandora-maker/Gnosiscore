import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import type { AdminStudentRow } from "@/types"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // student_roster has no admin RLS policy — the service-role client is required.
  const adminDb = createAdminClient()

  const { data: students, error } = await adminDb
    .from("users")
    .select("id, email, full_name, whatsapp, grade, subjects, account_status, is_active, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: roster } = await adminDb
    .from("student_roster")
    .select("student_user_id, teacher_id")
    .not("student_user_id", "is", null)

  const teacherIds = Array.from(new Set((roster ?? []).map((r) => r.teacher_id)))
  const { data: teachers } = teacherIds.length
    ? await adminDb.from("users").select("id, full_name, email").in("id", teacherIds)
    : { data: [] as { id: string; full_name: string; email: string }[] }

  const teacherName = new Map(
    (teachers ?? []).map((t) => [t.id, t.full_name?.trim() || t.email])
  )

  const links = new Map<string, Set<string>>()
  for (const row of roster ?? []) {
    if (!row.student_user_id) continue
    const set = links.get(row.student_user_id) ?? new Set<string>()
    const name = teacherName.get(row.teacher_id)
    if (name) set.add(name)
    links.set(row.student_user_id, set)
  }

  const rows: AdminStudentRow[] = (students ?? []).map((s) => {
    const names = links.get(s.id)
    return { ...s, linked: !!names && names.size > 0, educator_names: names ? Array.from(names) : [] }
  })

  return NextResponse.json({ students: rows })
}
