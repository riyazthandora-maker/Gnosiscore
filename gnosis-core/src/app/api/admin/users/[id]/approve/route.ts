import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendApprovalNotification } from "@/lib/email/send-approval-notification"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params

  // Verify the requesting user is an admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action, note }: { action: "approve" | "reject"; note?: string } = await request.json()
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  const newStatus = action === "approve" ? "approved" : "rejected"

  // Use service-role client to bypass RLS for cross-user updates
  const adminDb = createAdminClient()

  const { error: updateErr } = await adminDb
    .from("users")
    .update({
      account_status: newStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", targetUserId)
    .eq("role", "educator_parent")

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // In-app notification
  await adminDb.from("notifications").insert({
    user_id: targetUserId,
    type: action === "approve" ? "account_approved" : "account_rejected",
    payload: { admin_id: user.id, note: note ?? null },
  })

  // Email notification — fire-and-forget so a transient email failure never blocks the admin
  const { data: educator } = await adminDb
    .from("users")
    .select("email, full_name")
    .eq("id", targetUserId)
    .single()

  if (educator?.email) {
    sendApprovalNotification({
      toEmail: educator.email,
      fullName: educator.full_name ?? "there",
      action: action === "approve" ? "approved" : "rejected",
      note: note ?? null,
    }).catch((err) => console.error("[approve] email notification failed:", err))
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
