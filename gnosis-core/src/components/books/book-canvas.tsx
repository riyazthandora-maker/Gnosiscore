"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check, ChevronLeft, GripVertical, Loader2, Paperclip, Plus, Share2, Sparkles,
  Trash2, UserPlus, X,
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

const LEVEL_TEXT: Record<BlockLevel, string> = {
  chapter: "text-xl font-bold",
  section: "text-base font-semibold",
  details: "text-sm font-normal leading-relaxed",
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

// ── BlockRow ──────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: FlatBlock
  textIndent: number
  isDragOver: boolean
  isDragging: boolean
  isGenerating: boolean
  isReadOnly: boolean
  aiOpen: boolean
  aiPrompt: string
  presenceColor: string | null
  onAiPromptChange: (v: string) => void
  onAiSubmit: () => void
  onAiClose: () => void
  onTextChange: (id: string, text: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, id: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: (id: string) => void
  onDragEnd: () => void
  onAIClick: (id: string) => void
  onUploadClick: (id: string) => void
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
  isGenerating,
  isReadOnly,
  aiOpen,
  aiPrompt,
  presenceColor,
  onAiPromptChange,
  onAiSubmit,
  onAiClose,
  onTextChange,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onAIClick,
  onUploadClick,
  onDelete,
  onFocus,
  onBlur,
  inputRef,
}: BlockRowProps) {
  const [hovered, setHovered] = useState(false)
  const isDetails = block.level === "details"

  return (
    <div
      draggable={!isGenerating && !isReadOnly}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(block.id) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(block.id) }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(block.id) }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "rounded-lg transition-colors",
        isDragOver && !isDragging && "border-t-2 border-primary",
        isDragging && "opacity-30",
      )}
    >
      <div
        className={cn(
          "flex gap-1 rounded-lg px-1 transition-colors",
          isDetails ? "items-start py-1.5" : "items-center py-1",
          hovered && "bg-muted/40",
          isGenerating && "opacity-60",
        )}
        style={presenceColor
          ? { borderLeft: `3px solid ${presenceColor}`, paddingLeft: "5px" }
          : undefined
        }
      >
        <span className={cn(
          "shrink-0 cursor-grab p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-opacity",
          isDetails && "mt-0.5",
          hovered && !isGenerating && !isReadOnly ? "opacity-100" : "opacity-0",
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
            disabled={isGenerating || isReadOnly}
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
            disabled={isGenerating || isReadOnly}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground/35 disabled:cursor-default",
              LEVEL_TEXT[block.level],
            )}
          />
        )}

        {!isReadOnly && (
          <div className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            hovered || aiOpen || isGenerating ? "opacity-100" : "opacity-0 pointer-events-none",
          )}>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "text-muted-foreground",
                isGenerating ? "text-primary" : "hover:text-primary",
              )}
              onClick={() => !isGenerating && onAIClick(block.id)}
              disabled={isGenerating}
              title="AI assist"
            >
              {isGenerating
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Sparkles className="size-3.5" />
              }
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-primary"
              onClick={() => onUploadClick(block.id)}
              disabled={isGenerating}
              title="Upload file"
            >
              <Paperclip className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(block.id)}
              disabled={isGenerating}
              title="Delete block"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {aiOpen && (
        <div
          className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 mt-0.5 mb-1"
          style={{ marginLeft: textIndent + 24 }}
        >
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          <input
            autoFocus
            type="text"
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder="Describe what to generate here…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === "Escape") onAiClose()
              if (e.key === "Enter") onAiSubmit()
            }}
          />
          <Button variant="ghost" size="icon-xs" onClick={onAiClose}>
            <X className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" className="text-primary" onClick={onAiSubmit}>
            <Check className="size-3" />
          </Button>
        </div>
      )}
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
  const [aiBlockId, setAiBlockId] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState("")
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // ── AI generation ────────────────────────────────────────────────────────────

  function insertBlocks(afterId: string, newBlocks: { level: BlockLevel; text: string }[]) {
    const toInsert: FlatBlock[] = newBlocks.map((b) => ({ id: uid(), level: b.level, text: b.text }))
    mutate((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === afterId)
      const next = [...prev.blocks]
      next.splice(idx + 1, 0, ...toInsert)
      return { ...prev, blocks: next }
    })
  }

  async function generateFromPrompt(blockId: string, prompt: string) {
    const block = book?.blocks.find((b) => b.id === blockId)
    if (!block) return
    setAiBlockId(null)
    setAiPrompt("")
    setGeneratingId(blockId)
    try {
      const res = await fetch("/api/books/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockLevel: block.level,
          blockText: block.text,
          prompt,
          bookTitle: book?.title ?? "",
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Generation failed")
      const { blocks } = await res.json() as { blocks: { level: BlockLevel; text: string }[] }
      insertBlocks(blockId, blocks)
    } catch (err) {
      console.error("[book-canvas] AI generation error:", err)
    } finally {
      setGeneratingId(null)
    }
  }

  async function generateFromFile(blockId: string, file: File) {
    const block = book?.blocks.find((b) => b.id === blockId)
    if (!block) return
    setGeneratingId(blockId)
    try {
      const formData = new FormData()
      formData.append("blockLevel", block.level)
      formData.append("blockText", block.text)
      formData.append("bookTitle", book?.title ?? "")
      formData.append("file", file)
      const res = await fetch("/api/books/generate", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Generation failed")
      const { blocks } = await res.json() as { blocks: { level: BlockLevel; text: string }[] }
      insertBlocks(blockId, blocks)
    } catch (err) {
      console.error("[book-canvas] File generation error:", err)
    } finally {
      setGeneratingId(null)
      setUploadTargetId(null)
    }
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

  function deleteBlock(id: string) {
    mutate((prev) => {
      if (prev.blocks.length <= 1) return prev
      const idx = prev.blocks.findIndex((b) => b.id === id)
      const next = prev.blocks.filter((b) => b.id !== id)
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
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
            className="flex-1 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/35 disabled:cursor-default"
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
              Share
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
        <div className="rounded-xl border border-border bg-card p-4 space-y-0.5">
          {book.blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              textIndent={computeIndent(book.blocks, index)}
              isDragOver={dragOverId === block.id}
              isDragging={draggingId === block.id}
              isGenerating={generatingId === block.id}
              isReadOnly={isReadOnly}
              aiOpen={aiBlockId === block.id}
              aiPrompt={aiPrompt}
              presenceColor={presenceColorForBlock(block.id)}
              onAiPromptChange={setAiPrompt}
              onAiSubmit={() => generateFromPrompt(block.id, aiPrompt)}
              onAiClose={() => { setAiBlockId(null); setAiPrompt("") }}
              onTextChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onDragStart={setDraggingId}
              onDragOver={setDragOverId}
              onDrop={handleDrop}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
              onAIClick={(id) => {
                setAiBlockId((prev) => (prev === id ? null : id))
                setAiPrompt("")
              }}
              onUploadClick={(id) => {
                setUploadTargetId(id)
                fileInputRef.current?.click()
              }}
              onDelete={deleteBlock}
              onFocus={handleBlockFocus}
              onBlur={handleBlockBlur}
              inputRef={(el) => {
                if (el) inputRefs.current.set(block.id, el)
                else inputRefs.current.delete(block.id)
              }}
            />
          ))}

          {!isReadOnly && (() => {
            const sel = selectedBlockId ? book.blocks.find((b) => b.id === selectedBlockId) : null
            const canAddSection = sel?.level === "chapter"
            const canAddDetails = sel?.level === "chapter" || sel?.level === "section"
            return (
              <div className="mt-3 flex items-center gap-1 flex-wrap">
                <button
                  onClick={addChapter}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground transition-colors"
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
                      ? "text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground"
                      : "text-muted-foreground/25 cursor-not-allowed",
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
                      ? "text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground"
                      : "text-muted-foreground/25 cursor-not-allowed",
                  )}
                >
                  <Plus className="size-4" />
                  Add Details
                </button>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file && uploadTargetId) await generateFromFile(uploadTargetId, file)
          e.target.value = ""
        }}
      />

      {/* Share dialog */}
      {shareOpen && (
        <ShareDialog bookId={book.id} onClose={() => setShareOpen(false)} />
      )}
    </>
  )
}
