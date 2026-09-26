import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = user.user_metadata?.role
  if (role !== "student") redirect("/login")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-primary">GnosisCore</span>
        <div className="flex items-center gap-4">
          <Link href="/student/progress" className="text-sm text-muted-foreground hover:text-foreground">
            My Progress
          </Link>
          <Link href="/student/pacing" className="text-sm text-muted-foreground hover:text-foreground">
            My Schedule
          </Link>
          <Link href="/student/settings" className="text-sm text-muted-foreground hover:text-foreground">
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8">{children}</main>
    </div>
  )
}
