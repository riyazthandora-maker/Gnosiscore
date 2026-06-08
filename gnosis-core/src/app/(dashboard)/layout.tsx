import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch account_status to block pending educators from accessing the dashboard
  const { data: profile } = await supabase
    .from("users")
    .select("account_status, role")
    .eq("id", user.id)
    .single()

  if (profile?.role === "educator_parent" && profile.account_status === "pending") {
    redirect("/pending-approval")
  }

  return (
    <div className="flex min-h-screen">
      <DashboardNav />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
