import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { UserCheck, Sparkles, Users, BookOpen } from "lucide-react"

export const metadata: Metadata = { title: "Admin Dashboard — GnosisCore" }

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { count: pendingUsers },
    { count: pendingGen },
    { count: totalUsers },
    { count: totalTests },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true })
      .eq("role", "educator_parent").eq("account_status", "pending"),
    supabase.from("generation_requests").select("*", { count: "exact", head: true })
      .eq("status", "pending_admin"),
    supabase.from("users").select("*", { count: "exact", head: true })
      .neq("role", "admin"),
    supabase.from("tests").select("*", { count: "exact", head: true }),
  ])

  const pendingCards = [
    {
      label: "Pending registrations",
      value: pendingUsers ?? 0,
      href: "/admin/registrations",
      icon: UserCheck,
      urgent: (pendingUsers ?? 0) > 0,
    },
    {
      label: "Pending generation requests",
      value: pendingGen ?? 0,
      href: "/admin/generation-requests",
      icon: Sparkles,
      urgent: (pendingGen ?? 0) > 0,
    },
  ]

  const statCards = [
    { label: "Total users", value: totalUsers ?? 0, icon: Users },
    { label: "Tests created", value: totalTests ?? 0, icon: BookOpen },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Review pending approvals and platform activity.</p>
      </div>

      {/* Pending actions */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Needs action
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {pendingCards.map(({ label, value, href, icon: Icon, urgent }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-primary/50 ${
                urgent ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
              }`}
            >
              <div className={`flex size-10 items-center justify-center rounded-lg ${
                urgent ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Platform stats */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Platform
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {statCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
