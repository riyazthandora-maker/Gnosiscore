import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "Awaiting Approval" }

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, account_status")
    .eq("id", user.id)
    .single()

  // If approved, send them to the dashboard
  if (profile?.account_status === "approved") redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
          ⏳
        </div>
        <h1 className="text-2xl font-bold">Your account is under review</h1>
        <p className="text-muted-foreground">
          Hi {profile?.full_name ?? "there"}, your Educator/Parent account has been received and is
          waiting for Admin approval. You will be notified by email once it&apos;s approved.
        </p>
        <p className="text-sm text-muted-foreground">
          This usually takes less than 24 hours on working days.
        </p>
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
