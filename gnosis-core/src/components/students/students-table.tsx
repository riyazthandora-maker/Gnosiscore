"use client"

import { Mail, Pencil, Phone, RefreshCw, Trash2 } from "lucide-react"
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
  entries: RosterEntry[]
  onEdit: (entry: RosterEntry) => void
  onDelete: (entry: RosterEntry) => void
  onResendInvite: (entry: RosterEntry) => void
}

export function StudentsTable({ entries, onEdit, onDelete, onResendInvite }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No students found.</p>
        <p className="text-xs text-muted-foreground mt-1">Add a student using the button above.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Grade</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{entry.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                <a href={`mailto:${entry.email}`} className="flex items-center gap-1.5 hover:text-foreground min-w-0">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate max-w-48">{entry.email}</span>
                </a>
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                {entry.phone ? (
                  <a href={`tel:${entry.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    {entry.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {entry.grade?.name ?? <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="px-4 py-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[entry.status])}>
                  {STATUS_LABEL[entry.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {entry.status === "invited" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Resend invite"
                      onClick={() => onResendInvite(entry)}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Edit student"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    title="Remove student"
                    onClick={() => onDelete(entry)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
