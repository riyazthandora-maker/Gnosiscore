"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { BookOpen, Clock, BrainCircuit, Loader2, AlertCircle, LogIn } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

interface InviteInfo {
  id: string
  status: string
  invitee_email: string
  inviter: { display_name: string | null; email: string }
  test_configs: {
    toughness: string
    total_questions: number
    total_time_secs: number | null
    per_question_secs: number | null
    show_answer_mode: string
    topic_filter: string[] | null
    documents: { title: string }
  }
}

type Phase = "loading" | "ready" | "accepting" | "error"

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  return m > 0 ? `${m} min` : `${secs}s`
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("loading")
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // Check auth state
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(!!user))

    // Load invite info
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then(({ invitation, error }) => {
        if (error) { setErrorMsg(error); setPhase("error"); return }
        setInvite(invitation)
        setPhase("ready")
      })
      .catch(() => { setErrorMsg("Failed to load invitation."); setPhase("error") })
  }, [token])

  async function handleAccept() {
    if (!authed) {
      router.push(`/login?redirectTo=/invite/${token}`)
      return
    }
    setPhase("accepting")
    const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" })
    if (!res.ok) {
      const { error } = await res.json()
      setErrorMsg(error)
      setPhase("error")
      return
    }
    const { attempt_id } = await res.json()
    router.push(`/test/${attempt_id}`)
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-destructive" />
        <h1 className="text-xl font-bold">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{errorMsg}</p>
        <Link href="/"><Button variant="outline">Go to GnosisCore</Button></Link>
      </div>
    )
  }

  const cfg = invite!.test_configs
  const inviterName = invite!.inviter.display_name ?? invite!.inviter.email

  const details = [
    { label: "Document", value: cfg.documents.title },
    { label: "Difficulty", value: cfg.toughness, class: "capitalize" },
    { label: "Questions", value: String(cfg.total_questions) },
    { label: "Total time", value: cfg.total_time_secs ? formatTime(cfg.total_time_secs) : "Untimed" },
    { label: "Per question", value: cfg.per_question_secs ? `${cfg.per_question_secs}s` : "None" },
    { label: "Answers shown", value: cfg.show_answer_mode, class: "capitalize" },
    ...(cfg.topic_filter?.length ? [{ label: "Topics", value: cfg.topic_filter.join(", ") }] : []),
  ]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand */}
        <div className="text-center">
          <Link href="/" className="text-xl font-bold text-primary">GnosisCore</Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
              <BrainCircuit className="size-7 text-primary" />
            </div>
            <h1 className="text-lg font-bold">You've been invited to take a test</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{inviterName}</span> has invited you to test your knowledge.
            </p>
          </div>

          {/* Test details */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="size-4 text-primary" />
              <p className="text-sm font-semibold">Test details</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {details.map(({ label, value, class: cls }) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={`font-medium truncate ${cls ?? ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {cfg.total_time_secs && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Clock className="size-3.5 shrink-0" />
              This test is timed. Once you start, the clock runs.
            </div>
          )}

          {/* CTA */}
          <Button
            className="w-full gap-2"
            size="lg"
            disabled={phase === "accepting"}
            onClick={handleAccept}
          >
            {phase === "accepting" ? (
              <><Loader2 className="size-4 animate-spin" /> Generating your questions…</>
            ) : !authed ? (
              <><LogIn className="size-4" /> Sign in to take this test</>
            ) : (
              <><BookOpen className="size-4" /> Start test</>
            )}
          </Button>

          {!authed && (
            <p className="text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link href={`/register?redirectTo=/invite/${token}`} className="text-primary hover:underline">
                Create one free
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
