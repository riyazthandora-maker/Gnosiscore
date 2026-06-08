"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, UserCheck, Sparkles, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface PendingCounts {
  registrations: number
  generationRequests: number
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [counts, setCounts] = useState<PendingCounts>({ registrations: 0, generationRequests: 0 })

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    async function fetchCounts() {
      const [{ count: reg }, { count: gen }] = await Promise.all([
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("role", "educator_parent")
          .eq("account_status", "pending"),
        supabase
          .from("generation_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending_admin"),
      ])
      setCounts({ registrations: reg ?? 0, generationRequests: gen ?? 0 })
    }

    fetchCounts()

    // Realtime: re-fetch counts on any change to these tables
    const channel = supabase
      .channel("admin-pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_requests" }, fetchCounts)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const navItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: 0,
      exact: true,
    },
    {
      href: "/admin/registrations",
      label: "Registrations",
      icon: UserCheck,
      badge: counts.registrations,
      exact: false,
    },
    {
      href: "/admin/generation-requests",
      label: "Generation Requests",
      icon: Sparkles,
      badge: counts.generationRequests,
      exact: false,
    },
  ]

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <div className="mb-6 px-3">
        <p className="text-lg font-bold text-primary">GnosisCore</p>
        <p className="text-xs text-muted-foreground">Admin Panel</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon, badge, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <Badge count={badge} />
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </aside>
  )
}
