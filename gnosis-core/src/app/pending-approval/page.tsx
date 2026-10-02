import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { roleHomePath, type UserRole } from "@/types"

export const metadata: Metadata = { title: "Awaiting Approval" }

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, account_status, role")
    .eq("id", user.id)
    .single()

  const role: UserRole = (profile?.role ?? user.user_metadata?.role ?? "student") as UserRole

  // Approved users belong in their own area, not here.
  if (profile?.account_status === "approved") redirect(roleHomePath(role))

  const name = profile?.full_name ?? "there"
  const isRejected = profile?.account_status === "rejected"

  const content =
    role === "student"
      ? {
          icon: "🎒",
          iconClass: "bg-primary/10",
          title: "You're on the list",
          body: `Hi ${name}, your account is ready. An educator needs to add you to their class so we can give you the right support. We'll contact you soon — if you have an invite link from your teacher, open it to join now.`,
          note: "No need to do anything else — you'll hear from us shortly.",
        }
      : isRejected
        ? {
            icon: "🚫",
            iconClass: "bg-destructive/10",
            title: "Your account was not approved",
            body: `Hi ${name}, your registration could not be approved. If you think this is a mistake, please contact support and we'll take another look.`,
            note: null,
          }
        : {
            icon: "⏳",
            iconClass: "bg-amber-100",
            title: "Your account is under review",
            body: `Hi ${name}, your Educator/Parent account has been received and is waiting for Admin approval. You will be notified by email once it's approved.`,
            note: "This usually takes less than 24 hours on working days.",
          }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-4">
        <div className={`mx-auto flex size-16 items-center justify-center rounded-full text-3xl ${content.iconClass}`}>
          {content.icon}
        </div>
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-muted-foreground">{content.body}</p>
        {content.note && <p className="text-sm text-muted-foreground">{content.note}</p>}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
