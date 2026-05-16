"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { FileText, Loader2, AlertCircle, CheckCircle2, Trash2, BookOpen } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useDeleteDocument } from "@/lib/hooks/use-documents"
import { cn } from "@/lib/utils"
import type { Document } from "@/types"

const STATUS = {
  processing: {
    icon: Loader2,
    label: "Converting",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    spin: true,
  },
  ready: {
    icon: CheckCircle2,
    label: "Ready",
    color: "text-green-500",
    bg: "bg-green-500/10",
    spin: false,
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-destructive",
    bg: "bg-destructive/10",
    spin: false,
  },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  )
}

export function DocumentCard({ doc }: { doc: Document }) {
  const [confirming, setConfirming] = useState(false)
  const { mutate: deleteDoc, isPending } = useDeleteDocument()
  const status = STATUS[doc.status]
  const StatusIcon = status.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="size-5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatBytes(doc.file_size_bytes)}</span>
          {doc.token_count && <span>{doc.token_count.toLocaleString()} tokens</span>}
          <span>{formatDate(doc.created_at)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", status.bg, status.color)}>
          <StatusIcon className={cn("size-3", status.spin && "animate-spin")} />
          {status.label}
        </span>

        {doc.status === "ready" && (
          <Link href={`/tests/new?docId=${doc.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="size-3" /> New test
            </Button>
          </Link>
        )}

        {!confirming ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              disabled={isPending}
              onClick={() => deleteDoc(doc.id)}
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
