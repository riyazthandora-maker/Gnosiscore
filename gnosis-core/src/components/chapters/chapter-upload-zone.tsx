"use client"

import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { CloudUpload, FileText, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"]
const ACCEPTED_EXT = ".pdf,.png,.jpg,.jpeg,.webp"

type UploadState =
  | { phase: "idle" }
  | { phase: "selected"; file: File }
  | { phase: "uploading"; file: File; progress: number }
  | { phase: "done"; file: File }
  | { phase: "error"; message: string }

export function ChapterUploadZone({ chapterId }: { chapterId: string }) {
  const [state, setState] = useState<UploadState>({ phase: "idle" })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const selectFile = useCallback((file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setState({ phase: "error", message: "Only PDF, PNG, JPG, or WebP files are accepted." })
      return
    }
    setState({ phase: "selected", file })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) selectFile(file)
    },
    [selectFile]
  )

  async function upload() {
    if (state.phase !== "selected") return
    const { file } = state
    setState({ phase: "uploading", file, progress: 0 })

    const presignRes = await fetch(`/api/educator/chapters/${chapterId}/documents/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, size: file.size, mimeType: file.type }),
    })

    if (!presignRes.ok) {
      const { error } = await presignRes.json()
      setState({ phase: "error", message: error })
      return
    }

    const { token, storagePath } = await presignRes.json()
    setState((s) => s.phase === "uploading" ? { ...s, progress: 5 } : s)

    const uploadStart = Date.now()
    const estimatedMs = Math.max((file.size / (2 * 1024 * 1024)) * 1000, 3000)
    const timer = setInterval(() => {
      setState((s) => {
        if (s.phase !== "uploading") return s
        const pct = Math.min(5 + Math.round(((Date.now() - uploadStart) / estimatedMs) * 70), 75)
        return { ...s, progress: pct }
      })
    }, 300)

    const supabase = createClient()
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .uploadToSignedUrl(storagePath, token, file, { contentType: file.type, upsert: false })

    clearInterval(timer)

    if (uploadErr) {
      setState({ phase: "error", message: uploadErr.message })
      return
    }

    setState((s) => s.phase === "uploading" ? { ...s, progress: 82 } : s)

    const docRes = await fetch(`/api/educator/chapters/${chapterId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, storagePath, totalBytes: file.size }),
    })

    if (!docRes.ok) {
      const msg = await docRes.json()
        .then((j) => j?.error ?? `Server error ${docRes.status}`)
        .catch(() => `Server error ${docRes.status}`)
      setState({ phase: "error", message: msg })
      return
    }

    setState({ phase: "done", file })
    queryClient.invalidateQueries({ queryKey: ["chapter-docs", chapterId] })
    queryClient.invalidateQueries({ queryKey: ["chapters"] })
  }

  function reset() {
    setState({ phase: "idle" })
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:px-6 sm:py-10",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          state.phase === "done" && "border-green-500/40 bg-green-500/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => state.phase === "idle" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f) }}
        />

        <AnimatePresence mode="wait">
          {state.phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex flex-col items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <CloudUpload className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Drop a file here, or <span className="text-primary">browse</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">PDF, PNG, JPG, WebP</p>
              </div>
            </motion.div>
          )}

          {state.phase === "selected" && (
            <motion.div key="selected" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex flex-col items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{state.file.name}</p>
                <p className="text-xs text-muted-foreground">{(state.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </motion.div>
          )}

          {state.phase === "uploading" && (
            <motion.div key="uploading" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex w-full max-w-xs flex-col items-center gap-4">
              <p className="text-sm font-medium">Uploading {state.file.name}…</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: "5%" }}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}

          {state.phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
              <CheckCircle2 className="size-9 text-green-500" />
              <p className="font-medium text-sm">Upload complete</p>
              <p className="text-xs text-muted-foreground">Converting to Markdown — this takes a moment.</p>
            </motion.div>
          )}

          {state.phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex flex-col items-center gap-3">
              <AlertCircle className="size-9 text-destructive" />
              <p className="text-sm font-medium text-destructive">{state.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end gap-2">
        {(state.phase === "selected" || state.phase === "error") && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-3.5 mr-1" /> Clear
          </Button>
        )}
        {(state.phase === "done" || state.phase === "error") && (
          <Button variant="outline" size="sm" onClick={reset}>
            Upload more
          </Button>
        )}
        {state.phase === "selected" && (
          <Button size="sm" onClick={upload}>
            Upload & convert
          </Button>
        )}
      </div>
    </div>
  )
}
