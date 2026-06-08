"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { roleHomePath } from "@/types"
import type { UserRole } from "@/types"
import { Loader2 } from "lucide-react"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function redirect(userId: string, role: UserRole) {
      if (role === "educator_parent") {
        // Check if account is still pending — new registrations start as pending
        const { data } = await supabase
          .from("users")
          .select("account_status")
          .eq("id", userId)
          .single()
        if (data?.account_status === "pending") {
          router.replace("/pending-approval")
          return
        }
      }
      router.replace(roleHomePath(role))
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const role = (session.user.user_metadata?.role ?? "student") as UserRole
        redirect(session.user.id, role)
      } else if (event === "SIGNED_OUT" || !session) {
        router.replace("/login?error=auth_callback_failed")
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const role = (session.user.user_metadata?.role ?? "student") as UserRole
        redirect(session.user.id, role)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  )
}
