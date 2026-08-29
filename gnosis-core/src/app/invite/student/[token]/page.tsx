"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { GraduationCap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface InviteDetails {
  studentName: string
  studentEmail: string
  gradeName: string | null
  teacherName: string
  expiresAt: string | null
}

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invite: InviteDetails; session: "none" | "student" | "other" }
  | { status: "claimed" }

export default function StudentInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: "loading" })
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [inviteRes, supabase] = await Promise.all([
          fetch(`/api/invite/student/${token}`),
          Promise.resolve(createClient()),
        ])

        if (!inviteRes.ok) {
          const { error } = await inviteRes.json()
          setState({ status: "error", message: error ?? "Invalid or expired invite." })
          return
        }

        const { invite } = await inviteRes.json() as { invite: InviteDetails }
        const { data: { user } } = await supabase.auth.getUser()

        let session: "none" | "student" | "other" = "none"
        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single()
          session = profile?.role === "student" ? "student" : "other"
        }

        setState({ status: "ready", invite, session })
      } catch {
        setState({ status: "error", message: "Something went wrong. Please try again." })
      }
    }
    load()
  }, [token])

  async function handleClaim() {
    setClaiming(true)
    try {
      const res = await fetch(`/api/invite/student/${token}/claim`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setState({ status: "error", message: json.error ?? "Failed to claim invite." })
        return
      }
      setState({ status: "claimed" })
      setTimeout(() => router.push("/student"), 2000)
    } catch {
      setState({ status: "error", message: "Something went wrong." })
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
        {/* Brand header */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 px-8 py-6 text-center">
          <GraduationCap className="size-8 text-white mx-auto mb-2" />
          <p className="text-xl font-bold text-white">GnosisCore</p>
          <p className="text-sm text-white/70 mt-1">AI-Powered Practice Tests</p>
        </div>

        <div className="p-8">
          {state.status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading invite…</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="text-center py-4">
              <p className="font-medium text-destructive mb-2">Invite Unavailable</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}

          {state.status === "claimed" && (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-semibold">You've joined the class!</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecting to your dashboard…</p>
            </div>
          )}

          {state.status === "ready" && (
            <div>
              <p className="text-lg font-semibold mb-1">Hi, {state.invite.studentName}!</p>
              <p className="text-sm text-muted-foreground mb-6">
                <span className="font-medium text-foreground">{state.invite.teacherName}</span> has added you to their class on GnosisCore.
                {state.invite.gradeName && ` You've been placed in ${state.invite.gradeName}.`}
              </p>

              {state.session === "student" && (
                <div className="space-y-3">
                  <Button className="w-full" onClick={handleClaim} disabled={claiming}>
                    {claiming ? <><Loader2 className="size-4 animate-spin" /> Joining…</> : "Join Class"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    You're logged in and ready to join.
                  </p>
                </div>
              )}

              {state.session === "none" && (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => router.push(
                      `/auth/register?inviteToken=${token}&email=${encodeURIComponent(state.invite.studentEmail)}`
                    )}
                  >
                    Create Account & Join
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(
                      `/auth/login?redirect=${encodeURIComponent(`/invite/student/${token}`)}`
                    )}
                  >
                    Log in to Join
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Register with <strong>{state.invite.studentEmail}</strong> to join this class.
                  </p>
                </div>
              )}

              {state.session === "other" && (
                <div className="space-y-3">
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                    You're logged in as a teacher account. Please log in as a student to claim this invite.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(
                      `/auth/login?redirect=${encodeURIComponent(`/invite/student/${token}`)}`
                    )}
                  >
                    Switch Account
                  </Button>
                </div>
              )}

              {state.invite.expiresAt && (
                <p className="text-xs text-center text-muted-foreground mt-6">
                  Invite expires{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(state.invite.expiresAt))}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
