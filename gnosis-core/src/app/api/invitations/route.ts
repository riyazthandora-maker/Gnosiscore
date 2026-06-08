import { createClient } from "@/lib/supabase/server"
import { sendInvitationEmail } from "@/lib/email/send-invitation"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: invitations, error } = await supabase
    .from("test_invitations")
    .select("id, invitee_email, status, expires_at, created_at, token, test_configs(name, toughness, total_questions, documents(title))")
    .eq("inviter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 })

  return NextResponse.json({ invitations: invitations ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { config_id, invitee_email }: { config_id: string; invitee_email: string } = await request.json()

  if (!invitee_email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 })

  // Fetch config + inviter profile in parallel
  const [{ data: config }, { data: inviterProfile }] = await Promise.all([
    supabase
      .from("test_configs")
      .select("id, toughness, total_questions, total_time_secs, documents(title)")
      .eq("id", config_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("users")
      .select("display_name, email")
      .eq("id", user.id)
      .single(),
  ])

  if (!config) return NextResponse.json({ error: "Test configuration not found." }, { status: 404 })

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invitation, error } = await supabase
    .from("test_invitations")
    .insert({
      config_id,
      inviter_id: user.id,
      invitee_email: invitee_email.trim().toLowerCase(),
      token,
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${baseUrl}/invite/${token}`

  // Send email (non-blocking — invitation is already saved if email fails)
  if (process.env.RESEND_API_KEY) {
    const doc = config.documents as unknown as { title: string } | null
    const inviterName = inviterProfile?.display_name ?? inviterProfile?.email ?? "Someone"

    sendInvitationEmail({
      inviteeEmail: invitee_email.trim().toLowerCase(),
      inviterName,
      documentTitle: doc?.title ?? "a document",
      toughness: config.toughness,
      totalQuestions: config.total_questions,
      totalTimeSecs: config.total_time_secs,
      inviteUrl,
      expiresAt,
    }).catch((err) => {
      console.error("[email] Failed to send invitation email:", err.message)
    })
  }

  return NextResponse.json({ invitation, inviteUrl }, { status: 201 })
}
