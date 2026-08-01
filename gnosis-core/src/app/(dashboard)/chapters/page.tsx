"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { FolderOpen, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, FileText, HardDrive, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChapterWithStats } from "@/types"

interface ChaptersResponse {
  chapters: ChapterWithStats[]
  total: number
  page: number
  page_size: number
  total_storage_used: number
  monthly_uploads_used: number
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso))
}

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatBytes(used)} used</span>
        <span>of {formatBytes(limit)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CreateChapterForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: async (chapterName: string) => {
      const res = await fetch("/api/educator/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: chapterName }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapters"] })
      setName("")
      setOpen(false)
      setError("")
      onCreated()
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="size-4" />
        New Chapter
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium">Create a chapter</p>
      <input
        autoFocus
        type="text"
        placeholder="Chapter name (must be unique)"
        maxLength={120}
        value={name}
        onChange={(e) => { setName(e.target.value); setError("") }}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) mutate(name.trim()); if (e.key === "Escape") setOpen(false) }}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setError("") }}>Cancel</Button>
        <Button size="sm" disabled={!name.trim() || isPending} onClick={() => mutate(name.trim())}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
        </Button>
      </div>
    </div>
  )
}

function DeleteChapterButton({ chapterId, chapterName }: { chapterId: string; chapterName: string }) {
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/educator/chapters/${chapterId}`, { method: "DELETE" })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters"] }),
  })

  if (!confirming) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setConfirming(true) }}
        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
        title="Delete chapter"
      >
        <Trash2 className="size-4" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
      <span className="text-xs text-destructive font-medium">Delete "{chapterName}"?</span>
      <Button
        variant="destructive"
        size="sm"
        className="h-7 px-2.5 text-xs"
        disabled={isPending}
        onClick={() => mutate()}
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : "Yes, delete"}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  )
}

export default function ChaptersPage() {
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery<ChaptersResponse>({
    queryKey: ["chapters", page],
    queryFn: async () => {
      const res = await fetch(`/api/educator/chapters?page=${page}`)
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json()
    },
    staleTime: 10_000,
  })

  const chapters = data?.chapters ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 15
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chapters</h1>
          <p className="text-muted-foreground text-sm">Organise your documents into named chapters for test generation.</p>
        </div>
        <CreateChapterForm onCreated={() => setPage(1)} />
      </div>

      {/* Storage usage summary */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="size-4 text-muted-foreground" />
              Storage Used
            </div>
            <StorageBar used={data.total_storage_used} limit={200 * 1024 * 1024} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="size-4 text-muted-foreground" />
              Monthly Uploads
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.monthly_uploads_used}</p>
            <p className="text-xs text-muted-foreground">uploads this month</p>
          </div>
        </div>
      )}

      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <p className="text-sm text-destructive font-medium">Failed to load chapters.</p>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["chapters"] })} className="mt-2 text-xs text-muted-foreground underline">Retry</button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : chapters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-muted">
            <FolderOpen className="size-7 text-muted-foreground" />
          </div>
          <p className="font-medium">No chapters yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">Create a chapter above, then upload documents into it to use in test generation.</p>
        </div>
      ) : (
        <>
          <AnimatePresence>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <motion.div
                  key={chapter.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                >
                  <Link
                    href={`/chapters/${chapter.id}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FolderOpen className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{chapter.name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <FileText className="size-3" /> {chapter.doc_count} doc{chapter.doc_count !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="size-3" /> {formatBytes(chapter.storage_bytes)}
                        </span>
                        <span>Created {formatDate(chapter.created_at)}</span>
                      </div>
                    </div>
                    <DeleteChapterButton chapterId={chapter.id} chapterName={chapter.name} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1.5"
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
