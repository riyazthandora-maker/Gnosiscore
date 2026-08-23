"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, GripVertical, Loader2, Paperclip, Plus, Share2,
  Sparkles, Trash2, UserPlus, X,
} from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { BlockLevel, Book, Collaborator, FlatBlock } from "@/types/book"

// ── Presence ──────────────────────────────────────────────────────────────────

const PRESENCE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
]

function userColor(userId: string): string {
  let h = 0
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return PRESENCE_COLORS[Math.abs(h) % PRESENCE_COLORS.length]
}

interface PresenceEntry {
  userId: string
  display: string
  color: string
  focusedBlockId: string | null
}

// ── Block helpers ─────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const LEVELS: BlockLevel[] = ["chapter", "section", "details"]

function computeIndent(blocks: FlatBlock[], index: number): number {
  const level = blocks[index].level
  if (level === "chapter") return 0
  if (level === "section") return 20
  // details: look backwards for nearest chapter (→ 20px) or section (→ 40px)
  for (let i = index - 1; i >= 0; i--) {
    if (blocks[i].level === "chapter") return 20
    if (blocks[i].level === "section") return 40
  }
  return 20
}

function deeperLevel(level: BlockLevel): BlockLevel {
  return LEVELS[Math.min(LEVELS.indexOf(level) + 1, LEVELS.length - 1)]
}

function shallowerLevel(level: BlockLevel): BlockLevel {
  return LEVELS[Math.max(LEVELS.indexOf(level) - 1, 0)]
}

// End index (exclusive) of the range [idx, end) that must be removed so a
// deleted chapter/section also removes everything nested under it in the
// flat hierarchy: a chapter owns everything until the next chapter, and a
// section owns the details blocks until the next section or chapter.
function cascadeEnd(blocks: FlatBlock[], idx: number): number {
  if (blocks[idx].level === "chapter") {
    let end = idx + 1
    while (end < blocks.length && blocks[end].level !== "chapter") end++
    return end
  }
  if (blocks[idx].level === "section") {
    let end = idx + 1
    while (end < blocks.length && blocks[end].level === "details") end++
    return end
  }
  return idx + 1
}

const PER_FILE_MAX = 4 * 1024 * 1024
const BATCH_MAX = 7 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LEVEL_TEXT: Record<BlockLevel, string> = {
  chapter: "text-xl font-bold",
  section: "text-base font-semibold text-foreground",
  details: "text-sm font-normal leading-relaxed text-muted-foreground",
}

const LEVEL_PLACEHOLDER: Record<BlockLevel, string> = {
  chapter: "Chapter title…",
  section: "Section heading…",
  details: "Write details here…",
}

// ── ShareDialog ───────────────────────────────────────────────────────────────

function ShareDialog({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"editor" | "viewer">("editor")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState("")

  useEffect(() => {
    fetch(`/api/books/${bookId}/collaborators`)
      .then((r) => r.json())
      .then(({ collaborators: data }) => { setCollaborators(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [bookId])

  async function addCollaborator() {
    if (!email.trim() || adding) return
    setAdding(true)
    setAddError("")
    try {
      const res = await fetch(`/api/books/${bookId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? "Failed"); return }
      setCollaborators((p) => [...p, data.collaborator])
      setEmail("")
    } catch {
      setAddError("Failed to add collaborator")
    } finally {
      setAdding(false)
    }
  }

  async function removeCollaborator(userId: string) {
    setCollaborators((p) => p.filter((c) => c.user_id !== userId))
    await fetch(`/api/books/${bookId}/collaborators/${userId}`, { method: "DELETE" })
  }

  async function changeRole(userId: string, newRole: "editor" | "viewer") {
    setCollaborators((p) => p.map((c) => c.user_id === userId ? { ...c, role: newRole } : c))
    await fetch(`/api/books/${bookId}/collaborators/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Share Book</h2>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Add collaborator */}
        <div className="space-y-2 mb-5">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground/40"
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button size="sm" onClick={addCollaborator} disabled={adding || !email.trim()}>
              {adding
                ? <Loader2 className="size-3.5 animate-spin" />
                : <UserPlus className="size-3.5" />
              }
            </Button>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
        </div>

        {/* Collaborator list */}
        <div className="space-y-1">
          {loading ? (
            <p className="py-2 text-xs text-muted-foreground">Loading…</p>
          ) : collaborators.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No collaborators yet.</p>
          ) : (
            collaborators.map((c) => (
              <div key={c.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.full_name || c.email}</p>
                  {c.full_name && (
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  )}
                </div>
                <select
                  value={c.role}
                  onChange={(e) => changeRole(c.user_id, e.target.value as "editor" | "viewer")}
                  className="rounded-md border border-border bg-background px-1.5 py-1 text-xs outline-none"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCollaborator(c.user_id)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── AiOutlineDialog ───────────────────────────────────────────────────────────

function AiOutlineDialog({
  onClose,
  onMerge,
}: {
  onClose: () => void
  onMerge: (blocks: FlatBlock[]) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [draftBlocks, setDraftBlocks] = useState<FlatBlock[]>([])

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/books/ai-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json() as { blocks?: FlatBlock[]; error?: string }
      if (!res.ok) { setError(data.error ?? "Generation failed"); return }
      setDraftBlocks(data.blocks ?? [])
    } catch {
      setError("Generation failed")
    } finally {
      setLoading(false)
    }
  }

  function updateDraftText(id: string, text: string) {
    setDraftBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)))
  }

  function deleteDraftBlock(id: string) {
    setDraftBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      const end = cascadeEnd(prev, idx)
      return [...prev.slice(0, idx), ...prev.slice(end)]
    })
  }

  const hasDraft = draftBlocks.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-semibold">AI Outline Generator</h2>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {!hasDraft ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Describe the grade, subject, and chapter — e.g.{" "}
              <em>"Grade 5 Maths - Numbers"</em>
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  generate()
                }
              }}
              placeholder="Grade 5 Maths - Numbers"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground/40 resize-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={generate} disabled={!prompt.trim() || loading}>
              {loading ? (
                <><Loader2 className="size-3.5 animate-spin mr-1.5" />Generating…</>
              ) : (
                <><Sparkles className="size-3.5 mr-1.5" />Generate Outline</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 shrink-0">
              {draftBlocks.length} blocks generated. Edit below, then merge into your book.
            </p>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background/50 p-3 space-y-0.5 min-h-0 mb-4">
              {draftBlocks.map((block, index) => {
                const indent = computeIndent(draftBlocks, index)
                const isDetails = block.level === "details"
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "group flex items-start gap-1 rounded-lg px-2 py-1.5",
                      block.level === "section" && "mt-2 border-l-2 border-primary/40",
                    )}
                  >
                    {isDetails ? (
                      <textarea
                        value={block.text}
                        rows={1}
                        style={{ marginLeft: indent }}
                        onChange={(e) => {
                          updateDraftText(block.id, e.target.value)
                          e.currentTarget.style.height = "auto"
                          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.height = "auto"
                          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                        }}
                        className={cn(
                          "flex-1 bg-transparent outline-none resize-none overflow-hidden",
                          LEVEL_TEXT[block.level],
                        )}
                      />
                    ) : (
                      <input
                        type="text"
                        value={block.text}
                        style={{ marginLeft: indent }}
                        onChange={(e) => updateDraftText(block.id, e.target.value)}
                        className={cn(
                          "flex-1 bg-transparent outline-none",
                          LEVEL_TEXT[block.level],
                        )}
                      />
                    )}
                    <button
                      onClick={() => deleteDraftBlock(block.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setDraftBlocks([])}>
                ← Back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => { onMerge(draftBlocks); onClose() }}
                disabled={draftBlocks.length === 0}
              >
                Merge into Book ({draftBlocks.length})
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── ImportDialog ─────────────────────────────────────────────────────────────

function ImportDialog({
  onClose,
  onMerge,
}: {
  onClose: () => void
  onMerge: (blocks: FlatBlock[]) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [validationError, setValidationError] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [draftBlocks, setDraftBlocks] = useState<FlatBlock[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const arr = Array.from(selected)
    const oversized = arr.find((f) => f.size > PER_FILE_MAX)
    if (oversized) {
      setValidationError(`"${oversized.name}" exceeds the 4 MB per-file limit`)
      setFiles([])
      return
    }
    const totalSize = arr.reduce((sum, f) => sum + f.size, 0)
    if (totalSize > BATCH_MAX) {
      setValidationError(`Total size (${formatBytes(totalSize)}) exceeds the 7 MB batch limit`)
      setFiles([])
      return
    }
    setValidationError("")
    setFiles(arr)
  }

  async function processFiles() {
    if (files.length === 0 || loading) return
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      for (const f of files) formData.append("file", f)
      const res = await fetch("/api/books/ai-import", { method: "POST", body: formData })
      const data = await res.json() as { blocks?: FlatBlock[]; error?: string }
      if (!res.ok) { setError(data.error ?? "Processing failed"); return }
      setDraftBlocks(data.blocks ?? [])
    } catch {
      setError("Processing failed")
    } finally {
      setLoading(false)
    }
  }

  function updateDraftText(id: string, text: string) {
    setDraftBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)))
  }

  function deleteDraftBlock(id: string) {
    setDraftBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      const end = cascadeEnd(prev, idx)
      return [...prev.slice(0, idx), ...prev.slice(end)]
    })
  }

  const hasDraft = draftBlocks.length > 0
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Import & Structure with AI</h2>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {!hasDraft ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Upload PDFs or images — AI will extract and structure the content into your book hierarchy.
            </p>

            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/50 px-4 py-6 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-5 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Click to select files</p>
              <p className="text-xs text-muted-foreground/50">PDF, PNG, JPG · Max 4 MB per file · 7 MB total</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                    <span className="text-sm truncate flex-1 mr-2">{f.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-right">Total: {formatBytes(totalSize)}</p>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button
              onClick={processFiles}
              disabled={files.length === 0 || loading || !!validationError}
            >
              {loading ? (
                <><Loader2 className="size-3.5 animate-spin mr-1.5" />Processing…</>
              ) : (
                <><Sparkles className="size-3.5 mr-1.5" />Process & Structure</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 shrink-0">
              {draftBlocks.length} blocks extracted. Edit below, then merge into your book.
            </p>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-background/50 p-3 space-y-0.5 min-h-0 mb-4">
              {draftBlocks.map((block, index) => {
                const indent = computeIndent(draftBlocks, index)
                const isDetails = block.level === "details"
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "group flex items-start gap-1 rounded-lg px-2 py-1.5",
                      block.level === "section" && "mt-2 border-l-2 border-primary/40",
                    )}
                  >
                    {isDetails ? (
                      <textarea
                        value={block.text}
                        rows={1}
                        style={{ marginLeft: indent }}
                        onChange={(e) => {
                          updateDraftText(block.id, e.target.value)
                          e.currentTarget.style.height = "auto"
                          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.height = "auto"
                          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                        }}
                        className={cn(
                          "flex-1 bg-transparent outline-none resize-none overflow-hidden",
                          LEVEL_TEXT[block.level],
                        )}
                      />
                    ) : (
                      <input
                        type="text"
                        value={block.text}
                        style={{ marginLeft: indent }}
                        onChange={(e) => updateDraftText(block.id, e.target.value)}
                        className={cn("flex-1 bg-transparent outline-none", LEVEL_TEXT[block.level])}
                      />
                    )}
                    <button
                      onClick={() => deleteDraftBlock(block.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setDraftBlocks([])}>
                ← Back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => { onMerge(draftBlocks); onClose() }}
                disabled={draftBlocks.length === 0}
              >
                Merge into Book ({draftBlocks.length})
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── BlockRow ──────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: FlatBlock
  textIndent: number
  isDragOver: boolean
  isDragging: boolean
  isReadOnly: boolean
  presenceColor: string | null
  onTextChange: (id: string, text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, id: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: (id: string) => void
  onDragEnd: () => void
  onDelete: (id: string) => void
  onFocus: (id: string) => void
  onBlur: () => void
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
}

function BlockRow({
  block,
  textIndent,
  isDragOver,
  isDragging,
  isReadOnly,
  presenceColor,
  onTextChange,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDelete,
  onFocus,
  onBlur,
  inputRef,
}: BlockRowProps) {
  const [hovered, setHovered] = useState(false)
  const isDetails = block.level === "details"

  return (
    <div
      draggable={!isReadOnly}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(block.id) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(block.id) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(block.id) }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "rounded-lg transition-colors",
        block.level === "section" && "mt-2",
        isDragOver && !isDragging && "border-t-2 border-primary",
        isDragging && "opacity-30",
      )}
    >
      <div
        className={cn(
          "flex gap-1 rounded-lg px-1 transition-colors",
          isDetails ? "items-start py-2 sm:py-1.5" : "items-center py-2 sm:py-1",
          block.level === "section" && !presenceColor && "border-l-2 border-primary/40",
          hovered && (block.level === "section" ? "bg-primary/5" : "bg-muted/40"),
        )}
        style={presenceColor
          ? { borderLeft: `3px solid ${presenceColor}`, paddingLeft: "5px" }
          : undefined
        }
      >
        <span className={cn(
          "shrink-0 cursor-grab p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-opacity",
          isDetails && "mt-0.5",
          hovered && !isReadOnly ? "opacity-100" : "opacity-0",
        )}>
          <GripVertical className="size-4" />
        </span>

        {isDetails ? (
          <textarea
            ref={(el) => (inputRef as (el: HTMLTextAreaElement | null) => void)(el)}
            value={block.text}
            placeholder={LEVEL_PLACEHOLDER[block.level]}
            rows={1}
            style={{ marginLeft: textIndent }}
            onChange={(e) => {
              onTextChange(block.id, e.target.value)
              e.currentTarget.style.height = "auto"
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
            }}
            onKeyDown={(e) => onKeyDown(e as React.KeyboardEvent<HTMLElement>, block.id)}
            onFocus={(e) => {
              onFocus(block.id)
              e.currentTarget.style.height = "auto"
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
            }}
            onBlur={onBlur}
            disabled={isReadOnly}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground/35 disabled:cursor-default resize-none overflow-hidden",
              LEVEL_TEXT[block.level],
            )}
          />
        ) : (
          <input
            ref={inputRef as (el: HTMLInputElement | null) => void}
            type="text"
            value={block.text}
            placeholder={LEVEL_PLACEHOLDER[block.level]}
            style={{ marginLeft: textIndent }}
            onChange={(e) => onTextChange(block.id, e.target.value)}
            onKeyDown={(e) => onKeyDown(e as React.KeyboardEvent<HTMLElement>, block.id)}
            onFocus={() => onFocus(block.id)}
            onBlur={onBlur}
            disabled={isReadOnly}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground/35 disabled:cursor-default",
              LEVEL_TEXT[block.level],
            )}
          />
        )}

        {!isReadOnly && (
          <div className={cn(
            "flex shrink-0 items-center gap-0.5",
            "sm:transition-opacity",
            hovered ? "sm:opacity-100" : "sm:opacity-0 sm:pointer-events-none",
          )}>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(block.id)}
              title="Delete block"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BookCanvas ────────────────────────────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "error"

export default function BookCanvas({ bookId }: { bookId: string }) {
  const router = useRouter()
  const [book, setBook] = useState<Book | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myInfoRef = useRef<PresenceEntry>({
    userId: "",
    display: "",
    color: "",
    focusedBlockId: null,
  })
  const focusedBlockIdRef = useRef<string | null>(null)
  const isTitleFocusedRef = useRef(false)

  // ── Init: fetch book + set up Realtime ──────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        myInfoRef.current = {
          userId: user.id,
          display: user.email ?? user.id,
          color: userColor(user.id),
          focusedBlockId: null,
        }
      }

      const res = await fetch(`/api/books/${bookId}`)
      if (!res.ok) {
        setNotFound(true)
        setLoaded(true)
        return
      }
      const { book: data } = await res.json() as { book: Book }
      data.blocks = data.blocks.map((b) =>
        (b.level as string) === "concept" ? { ...b, level: "details" as BlockLevel } : b
      )
      setBook(data)
      setLoaded(true)

      if (!user) return

      const channel = supabase.channel(`book:${bookId}`, {
        config: { presence: { key: user.id } },
      })

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState()
          const others = Object.entries(state)
            .filter(([key]) => key !== user.id)
            .map(([, arr]) => arr[0] as unknown as PresenceEntry | undefined)
            .filter((e): e is PresenceEntry => e != null && "userId" in e)
          setPresence(others)
        })
        .on("broadcast", { event: "book_update" }, ({ payload }: { payload: {
          userId: string
          title: string
          blocks: FlatBlock[]
        }}) => {
          if (payload.userId === user.id) return
          applyRemoteBook(payload.title, payload.blocks)
        })

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myInfoRef.current)
        }
      })

      channelRef.current = channel
    }

    init()

    return () => {
      const ch = channelRef.current
      if (ch) {
        createClient().removeChannel(ch)
        channelRef.current = null
      }
    }
  }, [bookId])

  // ── Remote state merge ───────────────────────────────────────────────────────

  function applyRemoteBook(remoteTitle: string, remoteBlocks: FlatBlock[]) {
    setBook((prev) => {
      if (!prev) return prev
      const focusedId = focusedBlockIdRef.current

      let mergedBlocks: FlatBlock[]
      if (focusedId) {
        const localFocused = prev.blocks.find((b) => b.id === focusedId)
        mergedBlocks = remoteBlocks.map((b) =>
          b.id === focusedId && localFocused ? { ...b, text: localFocused.text } : b
        )
        if (localFocused && !remoteBlocks.some((b) => b.id === focusedId)) {
          mergedBlocks.push(localFocused)
        }
      } else {
        mergedBlocks = remoteBlocks
      }

      return {
        ...prev,
        title: isTitleFocusedRef.current ? prev.title : remoteTitle,
        blocks: mergedBlocks,
      }
    })
  }

  // ── Save & broadcast ─────────────────────────────────────────────────────────

  function scheduleSave(b: Book) {
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/books/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: b.title, blocks: b.blocks }),
        })
        setSaveStatus(res.ok ? "saved" : "error")
      } catch {
        setSaveStatus("error")
      }
    }, 1200)
  }

  function broadcastState(b: Book) {
    channelRef.current?.send({
      type: "broadcast",
      event: "book_update",
      payload: {
        userId: myInfoRef.current.userId,
        title: b.title,
        blocks: b.blocks,
      },
    })
  }

  const mutate = useCallback((updater: (prev: Book) => Book) => {
    setBook((prev) => {
      if (!prev) return prev
      const next = updater({ ...prev, updatedAt: new Date().toISOString() })
      scheduleSave(next)
      broadcastState(next)
      return next
    })
  }, [])

  // ── Presence: track focused block ────────────────────────────────────────────

  function trackPresence(focusedBlockId: string | null) {
    const ch = channelRef.current
    if (!ch || !myInfoRef.current.userId) return
    myInfoRef.current = { ...myInfoRef.current, focusedBlockId }
    ch.track(myInfoRef.current)
  }

  function handleBlockFocus(blockId: string) {
    focusedBlockIdRef.current = blockId
    setSelectedBlockId(blockId)
    trackPresence(blockId)
  }

  function handleBlockBlur() {
    focusedBlockIdRef.current = null
    trackPresence(null)
  }

  // ── Focus helper ─────────────────────────────────────────────────────────────

  function focusBlock(id: string) {
    setTimeout(() => inputRefs.current.get(id)?.focus(), 0)
  }

  // ── Block mutations ──────────────────────────────────────────────────────────

  function addBlock(afterId: string, level: BlockLevel) {
    const nb: FlatBlock = { id: uid(), level, text: "" }
    mutate((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === afterId)
      const next = [...prev.blocks]
      next.splice(idx + 1, 0, nb)
      return { ...prev, blocks: next }
    })
    focusBlock(nb.id)
  }

  function addChapter() {
    const nb: FlatBlock = { id: uid(), level: "chapter", text: "" }
    mutate((prev) => ({ ...prev, blocks: [...prev.blocks, nb] }))
    focusBlock(nb.id)
  }

  function addSection() {
    if (!selectedBlockId) return
    const block = book?.blocks.find((b) => b.id === selectedBlockId)
    if (block?.level !== "chapter") return
    addBlock(selectedBlockId, "section")
  }

  function addDetails() {
    if (!selectedBlockId) return
    const block = book?.blocks.find((b) => b.id === selectedBlockId)
    if (block?.level !== "chapter" && block?.level !== "section") return
    addBlock(selectedBlockId, "details")
  }

  function mergeAiBlocks(newBlocks: FlatBlock[]) {
    mutate((prev) => ({
      ...prev,
      blocks: [...prev.blocks, ...newBlocks.map((b) => ({ ...b, id: uid() }))],
    }))
  }

  function deleteBlock(id: string) {
    mutate((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      const end = cascadeEnd(prev.blocks, idx)
      const next = [...prev.blocks.slice(0, idx), ...prev.blocks.slice(end)]
      if (next.length === 0) return prev
      const focusIdx = Math.max(0, idx - 1)
      setTimeout(() => { if (next[focusIdx]) inputRefs.current.get(next[focusIdx].id)?.focus() }, 0)
      return { ...prev, blocks: next }
    })
  }

  function changeLevel(id: string, dir: 1 | -1) {
    mutate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === id ? { ...b, level: dir > 0 ? deeperLevel(b.level) : shallowerLevel(b.level) } : b
      ),
    }))
  }

  function handleTextChange(id: string, text: string) {
    mutate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    }))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>, id: string) {
    const block = book?.blocks.find((b) => b.id === id)
    if (!block) return
    if (block.level === "details") {
      if (e.key === "Backspace" && block.text === "") { e.preventDefault(); deleteBlock(id) }
      return
    }
    if (e.key === "Enter") { e.preventDefault(); addBlock(id, block.level) }
    else if (e.key === "Tab") { e.preventDefault(); changeLevel(id, e.shiftKey ? -1 : 1) }
    else if (e.key === "Backspace" && block.text === "") { e.preventDefault(); deleteBlock(id) }
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    mutate((prev) => {
      const from = prev.blocks.findIndex((b) => b.id === draggingId)
      const to = prev.blocks.findIndex((b) => b.id === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev.blocks]
      const [item] = next.splice(from, 1)
      next.splice(to > from ? to - 1 : to, 0, item)
      return { ...prev, blocks: next }
    })
    setDraggingId(null)
    setDragOverId(null)
  }

  // ── Presence lookup ──────────────────────────────────────────────────────────

  function presenceColorForBlock(blockId: string): string | null {
    return presence.find((p) => p.focusedBlockId === blockId)?.color ?? null
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const myRole = book?.role ?? "viewer"
  const isReadOnly = myRole === "viewer"
  const isOwner = myRole === "owner"

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
      </div>
    )
  }

  if (notFound || !book) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-muted-foreground">Book not found</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          It may have been deleted or you may not have access.
        </p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/books")}>
          <ChevronLeft className="size-4" /> Back to Books
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className={cn("space-y-6", !isReadOnly && "pb-16")}>
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push("/books")}>
            <ChevronLeft className="size-4" />
          </Button>

          <input
            type="text"
            value={book.title}
            onChange={(e) =>
              mutate((prev) => ({ ...prev, title: e.target.value }))
            }
            onFocus={() => { isTitleFocusedRef.current = true }}
            onBlur={() => { isTitleFocusedRef.current = false }}
            placeholder="Untitled Book"
            disabled={isReadOnly}
            className="flex-1 min-w-0 bg-transparent text-xl sm:text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/35 disabled:cursor-default"
          />

          {/* Presence avatars */}
          {presence.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {presence.slice(0, 5).map((p) => (
                <div
                  key={p.userId}
                  title={p.display}
                  className="flex size-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.display.charAt(0).toUpperCase()}
                </div>
              ))}
              {presence.length > 5 && (
                <div className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                  +{presence.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportOpen(true)}
              title="Import & Structure with AI"
              className="shrink-0 gap-1.5 text-muted-foreground"
            >
              <Paperclip className="size-3.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}

          {/* AI Outline Generator */}
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiOpen(true)}
              title="AI Outline Generator"
              className="shrink-0 gap-1.5 text-muted-foreground"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">AI Outline</span>
            </Button>
          )}

          {/* Save status */}
          <span className={cn(
            "shrink-0 text-xs",
            saveStatus === "error" ? "text-destructive" : "text-muted-foreground",
          )}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "Saved"}
          </span>

          {/* Share (owner only) */}
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}
        </div>

        {/* Read-only banner */}
        {isReadOnly && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            You have <strong>view-only</strong> access to this book.
          </div>
        )}

        {/* Canvas */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-0.5">
          {book.blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              textIndent={computeIndent(book.blocks, index)}
              isDragOver={dragOverId === block.id}
              isDragging={draggingId === block.id}
              isReadOnly={isReadOnly}
              presenceColor={presenceColorForBlock(block.id)}
              onTextChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onDragStart={setDraggingId}
              onDragOver={setDragOverId}
              onDrop={handleDrop}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
              onDelete={deleteBlock}
              onFocus={handleBlockFocus}
              onBlur={handleBlockBlur}
              inputRef={(el) => {
                if (el) inputRefs.current.set(block.id, el)
                else inputRefs.current.delete(block.id)
              }}
            />
          ))}

        </div>
      </div>

      {/* Sticky add toolbar */}
      {!isReadOnly && (() => {
        const sel = selectedBlockId ? book.blocks.find((b) => b.id === selectedBlockId) : null
        const canAddSection = sel?.level === "chapter"
        const canAddDetails = sel?.level === "chapter" || sel?.level === "section"
        return (
          <div className="sticky bottom-0 z-20 flex items-center gap-1 flex-wrap rounded-xl border border-border bg-card/95 px-3 py-2 backdrop-blur-sm shadow-sm">
            <button
              onClick={addChapter}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground transition-colors"
            >
              <Plus className="size-4" />
              Add Chapter
            </button>
            <button
              onClick={addSection}
              disabled={!canAddSection}
              title={canAddSection ? undefined : "Select a chapter first"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                canAddSection
                  ? "text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground"
                  : "text-muted-foreground/20 cursor-not-allowed",
              )}
            >
              <Plus className="size-4" />
              Add Section
            </button>
            <button
              onClick={addDetails}
              disabled={!canAddDetails}
              title={canAddDetails ? undefined : "Select a chapter or section first"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                canAddDetails
                  ? "text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground"
                  : "text-muted-foreground/20 cursor-not-allowed",
              )}
            >
              <Plus className="size-4" />
              Add Details
            </button>
          </div>
        )
      })()}

      {/* Share dialog */}
      {shareOpen && (
        <ShareDialog bookId={book.id} onClose={() => setShareOpen(false)} />
      )}

      {/* AI Outline dialog */}
      {aiOpen && (
        <AiOutlineDialog
          onClose={() => setAiOpen(false)}
          onMerge={mergeAiBlocks}
        />
      )}

      {/* Import dialog */}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onMerge={mergeAiBlocks}
        />
      )}
    </>
  )
}
