"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Copy, Check, Trash2, Loader2, Send, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInvitations, useCreateInvitation, useRevokeInvitation } from "@/lib/hooks/use-invitations"
import { cn } from "@/lib/utils"
import type { TestConfig } from "@/types"

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  expired: "bg-muted text-muted-foreground",
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80 transition-colors">
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  )
}

export function InvitationPanel({ configs }: { configs: TestConfig[] }) {
  const { data, isLoading } = useInvitations()
  const { mutate: create, isPending, error } = useCreateInvitation()
  const { mutate: revoke } = useRevokeInvitation()

  const [email, setEmail] = useState("")
  const [configId, setConfigId] = useState(configs[0]?.id ?? "")
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !configId) return
    setNewInviteUrl(null)
    create(
      { config_id: configId, invitee_email: email },
      {
        onSuccess: (res) => {
          setNewInviteUrl(res.inviteUrl)
          setEmail("")
        },
      }
    )
  }

  if (!configs.length) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Generate at least one test before sending invitations.
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Create invitation */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-primary" />
          <h2 className="font-semibold">Send a test invitation</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The invitee signs in (or creates an account) and takes a freshly generated copy of the selected test.
        </p>

        <form onSubmit={handleCreate} className="space-y-3">
          {/* Config selector */}
          <div className="relative">
            <select
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.document?.title ?? "Untitled"} · {c.total_questions}q · {c.toughness}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="invitee@gmail.com"
              required
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <Button type="submit" size="sm" disabled={isPending || !email.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            </Button>
          </div>
        </form>

        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

        <AnimatePresence>
          {newInviteUrl && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2"
            >
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Invitation created — share this link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{newInviteUrl}</code>
                <CopyButton text={newInviteUrl} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sent invitations list */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sent invitations</p>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : !data?.invitations.length ? (
          <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
        ) : (
          <AnimatePresence>
            {data.invitations.map((inv) => {
              const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
              const inviteUrl = `${baseUrl}/invite/${inv.token}`
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{inv.invitee_email}</p>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[inv.status] ?? STATUS_STYLE.pending)}>
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inv.test_configs?.documents?.title ?? "—"} · {inv.test_configs?.toughness} · {inv.test_configs?.total_questions}q
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {inv.status === "pending" && <CopyButton text={inviteUrl} />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => revoke(inv.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
