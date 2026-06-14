"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { FileText, RefreshCw } from "lucide-react"
import { DocumentCard } from "./document-card"
import { useDocuments } from "@/lib/hooks/use-documents"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import type { Document } from "@/types"

export function DocumentsList() {
  const { documents, isLoading, isError } = useDocuments()
  const queryClient = useQueryClient()
  const [reprocessingAll, setReprocessingAll] = useState(false)

  const reprocessable = (documents as Document[]).filter(
    (d) => d.processing_status === "ready" || d.processing_status === "failed"
  )

  async function handleReprocessAll() {
    setReprocessingAll(true)
    try {
      await Promise.allSettled(
        reprocessable.map((d) =>
          fetch(`/api/documents/${d.id}/process`, { method: "POST" })
        )
      )
      await queryClient.invalidateQueries({ queryKey: ["documents"] })
    } finally {
      setReprocessingAll(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Failed to load documents. Please refresh.</p>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <p className="font-medium">No documents yet</p>
        <p className="text-sm text-muted-foreground">Upload a PDF or image above to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reprocessable.length > 1 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-3 text-xs"
            disabled={reprocessingAll}
            onClick={handleReprocessAll}
          >
            <RefreshCw className={`size-3 ${reprocessingAll ? "animate-spin" : ""}`} />
            {reprocessingAll ? "Reprocessing…" : `Reprocess all (${reprocessable.length})`}
          </Button>
        </div>
      )}
      <AnimatePresence>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </AnimatePresence>
    </div>
  )
}
