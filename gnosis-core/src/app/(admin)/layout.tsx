import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminNav } from "@/components/admin/admin-nav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = user.user_metadata?.role
  if (role !== "admin") redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="md:hidden h-14" />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
