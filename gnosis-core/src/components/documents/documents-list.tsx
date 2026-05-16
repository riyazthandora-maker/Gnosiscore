"use client"

import { AnimatePresence } from "framer-motion"
import { FileText } from "lucide-react"
import { DocumentCard } from "./document-card"
import { useDocuments } from "@/lib/hooks/use-documents"

export function DocumentsList() {
  const { documents, isLoading, isError } = useDocuments()

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
      <AnimatePresence>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </AnimatePresence>
    </div>
  )
}
