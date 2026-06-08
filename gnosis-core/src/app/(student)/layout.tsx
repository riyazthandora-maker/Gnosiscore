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
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-8">{children}</main>
    </div>
  )
}
