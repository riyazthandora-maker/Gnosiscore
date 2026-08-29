"use client"

import { Mail, MoreVertical, Pencil, Phone, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { RosterEntry } from "@/types"

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  invited: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  archived: "bg-muted text-muted-foreground",
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  invited: "Invite Pending",
  archived: "Archived",
}

interface Props {
  entry: RosterEntry
  onEdit: (entry: RosterEntry) => void
  onDelete: (entry: RosterEntry) => void
  onResendInvite: (entry: RosterEntry) => void
}

export function StudentCard({ entry, onEdit, onDelete, onResendInvite }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{entry.name}</p>
          {entry.grade && (
            <p className="text-xs text-muted-foreground mt-0.5">{entry.grade.name}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[entry.status])}>
            {STATUS_LABEL[entry.status]}
          </span>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreVertical className="size-4" />
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 min-w-36 rounded-lg border border-border bg-popover shadow-lg py-1">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => { setMenuOpen(false); onEdit(entry) }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                  {entry.status === "invited" && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setMenuOpen(false); onResendInvite(entry) }}
                    >
                      <Mail className="size-3.5" /> Resend Invite
                    </button>
                  )}
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => { setMenuOpen(false); onDelete(entry) }}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-3 space-y-1">
        <a
          href={`mailto:${entry.email}`}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground min-w-0"
        >
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{entry.email}</span>
        </a>
        {entry.phone && (
          <a
            href={`tel:${entry.phone}`}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Phone className="size-3.5 shrink-0" />
            <span>{entry.phone}</span>
          </a>
        )}
      </div>
    </div>
  )
}
