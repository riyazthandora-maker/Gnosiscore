"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, BookOpen, FileText, LayoutDashboard, LogOut, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/tests", label: "Tests", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4">
      <Link href="/dashboard" className="mb-6 px-3 text-lg font-bold text-primary">
        GnosisCore
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 px-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
        <ThemeToggle />
      </div>
    </aside>
  )
}
