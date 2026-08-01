import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// [id] is the test_id — cancels all student assignments for that test
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("test_assignments")
    .delete()
    .eq("test_id", testId)
    .eq("assigned_by", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
