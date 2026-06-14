import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: links } = await supabase
    .from("educator_students")
    .select("student_id")
    .eq("educator_id", user.id)

  if (!links || links.length === 0) return NextResponse.json({ students: [] })

  const studentIds = links.map((l) => l.student_id)
  const adminDb = createAdminClient()
  const { data: students } = await adminDb
    .from("users")
    .select("id, email, full_name")
    .in("id", studentIds)
    .order("full_name", { ascending: true })

  return NextResponse.json({ students: students ?? [] })
}
