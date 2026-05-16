"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { BookOpen, Clock, Trophy, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvitationPanel } from "@/components/quiz/invitation-panel"
import { cn } from "@/lib/utils"
import type { ConfigSnapshot, TestConfig } from "@/types"

interface AttemptRow {
  id: string
  score_pct: number | null
  time_taken_secs: number | null
  total_answered: number
  completed_at: string | null
  started_at: string
  status: string
  config_snapshot: ConfigSnapshot
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60); const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}
function scoreColor(pct: number) {
  if (pct >= 80) return "text-green-600 dark:text-green-400"
  if (pct >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-destructive"
}

type Tab = "history" | "invitations"

export default function TestsPage() {
  const [tab, setTab] = useState<Tab>("history")

  const { data: attemptsData, isLoading: attemptsLoading } = useQuery<{ attempts: AttemptRow[] }>({
    queryKey: ["attempts"],
    queryFn: () => fetch("/api/tests/attempts").then((r) => r.json()),
  })

  const { data: configsData } = useQuery<{ configs: TestConfig[] }>({
    queryKey: ["test-configs"],
    queryFn: () => fetch("/api/tests/configs").then((r) => r.json()),
    enabled: tab === "invitations",
  })

  const attempts = attemptsData?.attempts ?? []
  const configs = configsData?.configs ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tests</h1>
        <p className="text-muted-foreground">Your test history and invitations.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {(["history", "invitations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "invitations" ? <span className="flex items-center gap-1.5"><Send className="size-3.5" />Invitations</span> : "History"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {attemptsLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : !attempts.length ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                <BookOpen className="size-10 text-muted-foreground/40" />
                <p className="font-medium">No tests yet</p>
                <p className="text-sm text-muted-foreground">Upload a document and click New test to begin.</p>
                <Link href="/documents"><Button variant="outline" size="sm">Go to documents</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">
                {attempts.map((a) => {
                  const snap = a.config_snapshot
                  const completed = a.status === "completed"
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{snap.document_title}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="capitalize">{snap.toughness}</span>
                          <span>{snap.total_questions}q</span>
                          {a.time_taken_secs && (
                            <span className="flex items-center gap-1"><Clock className="size-3" />{formatTime(a.time_taken_secs)}</span>
                          )}
                          <span>{formatDate(a.started_at)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {completed && a.score_pct != null && (
                          <div className="text-right">
                            <p className={cn("text-xl font-bold tabular-nums", scoreColor(a.score_pct))}>
                              {Math.round(a.score_pct)}%
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-0.5 justify-end">
                              <Trophy className="size-3" />{a.total_answered}/{snap.total_questions}
                            </p>
                          </div>
                        )}
                        {completed ? (
                          <Link href={`/test/${a.id}/results`}>
                            <Button variant="outline" size="sm" className="text-xs">Results</Button>
                          </Link>
                        ) : (
                          <Link href={`/test/${a.id}`}>
                            <Button size="sm" className="text-xs">Resume</Button>
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === "invitations" && (
          <motion.div key="invitations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InvitationPanel configs={configs} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
