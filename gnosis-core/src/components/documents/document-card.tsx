"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { FileText, Loader2, AlertCircle, CheckCircle2, Trash2, BookOpen, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useDeleteDocument } from "@/lib/hooks/use-documents"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import type { Document } from "@/types"

const STATUS = {
  pending: {
    icon: Loader2,
    label: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted",
    spin: false,
  },
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
  const [reprocessing, setReprocessing] = useState(false)
  const { mutate: deleteDoc, isPending } = useDeleteDocument()
  const queryClient = useQueryClient()
  const status = STATUS[doc.processing_status] ?? STATUS.pending
  const StatusIcon = status.icon

  async function handleReprocess() {
    setReprocessing(true)
    try {
      await fetch(`/api/documents/${doc.id}/process`, { method: "POST" })
      await queryClient.invalidateQueries({ queryKey: ["documents"] })
    } finally {
      setReprocessing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted sm:size-10">
        <FileText className="size-4 text-muted-foreground sm:size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium sm:text-base">{doc.file_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{formatBytes(doc.total_bytes)}</span>
          {doc.chunk_count && <span className="hidden sm:inline">{doc.chunk_count.toLocaleString()} chunks</span>}
          <span>{formatDate(doc.created_at)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium", status.bg, status.color)}>
          <StatusIcon className={cn("size-3", status.spin && "animate-spin")} />
          <span className="hidden sm:inline">{status.label}</span>
        </span>

        {doc.processing_status === "ready" && (
          <Link href={`/tests/generate?docId=${doc.id}`}>
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <BookOpen className="size-3" />
              <span className="hidden sm:inline">New test</span>
            </Button>
          </Link>
        )}

        {(doc.processing_status === "failed" || doc.processing_status === "ready") && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-primary sm:size-8"
            disabled={reprocessing}
            onClick={handleReprocess}
            title="Reprocess document"
          >
            <RefreshCw className={cn("size-3.5 sm:size-4", reprocessing && "animate-spin")} />
          </Button>
        )}

        {!confirming ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive sm:size-8"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5 sm:size-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isPending}
              onClick={() => deleteDoc(doc.id)}
            >
              {isPending ? <Loader2 className="size-3 animate-spin" /> : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
