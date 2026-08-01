"use client"

import { use, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, FileText, Trash2, Loader2, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChapterUploadZone } from "@/components/chapters/chapter-upload-zone"
import { cn } from "@/lib/utils"
import type { Document } from "@/types"

interface DocsResponse {
  documents: Document[]
  total: number
  page: number
  page_size: number
}

interface ChapterResponse {
  chapter: { id: string; name: string; created_at: string }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: Document["processing_status"] }) {
  const map = {
    pending:    { icon: Clock,        cls: "text-amber-500",    label: "Pending" },
    processing: { icon: Loader2,      cls: "text-blue-500",     label: "Processing" },
    ready:      { icon: CheckCircle2, cls: "text-green-500",    label: "Ready" },
    failed:     { icon: XCircle,      cls: "text-destructive",  label: "Failed" },
  }
  const { icon: Icon, cls, label } = map[status] ?? map.pending
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", cls)}>
      <Icon className={cn("size-3.5", status === "processing" && "animate-spin")} />
      {label}
    </span>
  )
}

function DeleteDocButton({ chapterId, docId, docName }: { chapterId: string; docId: string; docName: string }) {
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/educator/chapters/${chapterId}/documents/${docId}`, { method: "DELETE" })
      if (res.status !== 204 && !res.ok) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-docs", chapterId] })
      qc.invalidateQueries({ queryKey: ["chapters"] })
    },
  })

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
        title="Delete document"
      >
        <Trash2 className="size-4" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-destructive font-medium hidden sm:block">Delete "{docName}"?</span>
      <Button variant="destructive" size="sm" className="h-7 px-2.5 text-xs" disabled={isPending} onClick={() => mutate()}>
        {isPending ? <Loader2 className="size-3 animate-spin" /> : "Delete"}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  )
}

export default function ChapterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chapterId } = use(params)
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data: chapterData } = useQuery<ChapterResponse>({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const res = await fetch(`/api/educator/chapters/${chapterId}`)
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json()
    },
  })

  const { data, isLoading, isError } = useQuery<DocsResponse>({
    queryKey: ["chapter-docs", chapterId, page],
    queryFn: async () => {
      const res = await fetch(`/api/educator/chapters/${chapterId}/documents?page=${page}`)
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json()
    },
    refetchInterval: (query) => {
      const docs = query.state.data?.documents ?? []
      const hasProcessing = docs.some(
        (d) => d.processing_status === "processing" || d.processing_status === "pending"
      )
      return hasProcessing ? 4000 : false
    },
  })

  const docs = data?.documents ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 15
  const totalPages = Math.ceil(total / pageSize)
  const chapterName = chapterData?.chapter.name ?? "Chapter"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/chapters" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{chapterName}</h1>
          <p className="text-muted-foreground text-sm">{total} document{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <ChapterUploadZone chapterId={chapterId} />

      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <p className="text-sm text-destructive font-medium">Failed to load documents.</p>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["chapter-docs", chapterId] })} className="mt-2 text-xs text-muted-foreground underline">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground">Upload a PDF or image above to add it to this chapter.</p>
        </div>
      ) : (
        <>
          <AnimatePresence>
            <div className="space-y-2">
              {docs.map((doc) => (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.file_name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <StatusBadge status={doc.processing_status} />
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.total_bytes)}</span>
                      {doc.chunk_count != null && doc.processing_status === "ready" && (
                        <span className="text-xs text-muted-foreground">{doc.chunk_count} chunks</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.processing_status === "failed" && (
                      <button
                        onClick={() => fetch(`/api/documents/${doc.id}/process`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["chapter-docs", chapterId] }))}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                        title="Retry processing"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    )}
                    <DeleteDocButton chapterId={chapterId} docId={doc.id} docName={doc.file_name} />
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="gap-1.5">
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="gap-1.5">
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
