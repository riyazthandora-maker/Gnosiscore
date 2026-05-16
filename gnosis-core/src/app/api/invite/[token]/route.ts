import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  // Public route — no auth required to view invite info
  const supabase = await createClient()

  const { data: invitation } = await supabase
    .from("test_invitations")
    .select(`
      id, status, expires_at, invitee_email,
      inviter:users!inviter_id(display_name, email),
      test_configs(
        toughness, total_questions, total_time_secs, per_question_secs, show_answer_mode, topic_filter,
        documents(title)
      )
    `)
    .eq("token", token)
    .maybeSingle()

  if (!invitation) return NextResponse.json({ error: "Invitation not found." }, { status: 404 })

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase.from("test_invitations").update({ status: "expired" }).eq("token", token)
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 })
  }

  if (invitation.status === "completed") {
    return NextResponse.json({ error: "This invitation has already been used." }, { status: 409 })
  }

  return NextResponse.json({ invitation })
}
