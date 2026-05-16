"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Users, X, Loader2, ExternalLink, UserCheck } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSharing, useGrantShare, useRevokeShare } from "@/lib/hooks/use-sharing"
import { cn } from "@/lib/utils"

function avatar(name: string | null, email: string) {
  const initials = name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : email[0].toUpperCase()
  return initials
}

export function SharePanel() {
  const { data, isLoading } = useSharing()
  const { mutate: grant, isPending: granting, error: grantErr } = useGrantShare()
  const { mutate: revoke } = useRevokeShare()
  const [email, setEmail] = useState("")

  function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    grant(email, { onSuccess: () => setEmail("") })
  }

  return (
    <div className="space-y-6">

      {/* Grant access */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="font-semibold">Share your dashboard</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite another GnosisCore user to view your analytics (read-only).
        </p>
        <form onSubmit={handleGrant} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their@email.com"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <Button type="submit" size="sm" disabled={granting || !email.trim()}>
            {granting ? <Loader2 className="size-4 animate-spin" /> : "Invite"}
          </Button>
        </form>
        {grantErr && <p className="text-xs text-destructive">{(grantErr as Error).message}</p>}

        {/* Granted list */}
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : data?.granted.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Currently shared with</p>
            <AnimatePresence>
              {data.granted.map((s) => {
                const person = s.viewer!
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {avatar(person.display_name, person.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{person.display_name ?? person.email}</p>
                      {person.display_name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => revoke(s.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Not shared with anyone yet.</p>
        )}
      </section>

      {/* Received access */}
      {data?.received.length ? (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-green-500" />
            <h2 className="font-semibold text-sm">Dashboards shared with you</h2>
          </div>
          <div className="space-y-2">
            {data.received.map((s) => {
              const person = s.owner!
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600 dark:text-green-400">
                    {avatar(person.display_name, person.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.display_name ?? person.email}</p>
                  </div>
                  <Link href={`/shared/${person.id}`}>
                    <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs")}>
                      <ExternalLink className="size-3" /> View
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
