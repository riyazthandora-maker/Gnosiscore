"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, ChevronRight, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWizard } from "@/components/exams/wizard-context"
import type { FlatBlock } from "@/types/book"

// ── Tree types ──────────────────────────────────────────────────────────────

interface SectionNode {
  id: string
  text: string
}

interface ChapterNode {
  id: string
  text: string
  sections: SectionNode[]
}

interface BookTree {
  id: string
  title: string
  chapters: ChapterNode[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTree(blocks: FlatBlock[]): ChapterNode[] {
  const chapters: ChapterNode[] = []
  let cur: ChapterNode | null = null
  for (const b of blocks) {
    if (b.level === "chapter") {
      cur = { id: b.id, text: b.text, sections: [] }
      chapters.push(cur)
    } else if (b.level === "section" && cur) {
      cur.sections.push({ id: b.id, text: b.text })
    }
  }
  return chapters
}

function filterTree(trees: BookTree[], query: string): BookTree[] {
  if (!query.trim()) return trees
  const q = query.toLowerCase()
  return trees
    .map((book) => ({
      ...book,
      chapters: book.chapters
        .map((ch) => ({
          ...ch,
          sections: ch.sections.filter((s) => s.text.toLowerCase().includes(q)),
        }))
        .filter((ch) => ch.text.toLowerCase().includes(q) || ch.sections.length > 0),
    }))
    .filter((book) => book.chapters.length > 0 || book.title.toLowerCase().includes(q))
}

// ── Checkbox with indeterminate support ──────────────────────────────────────

function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={cn("size-4 shrink-0 cursor-pointer accent-primary", className)}
    />
  )
}

// ── Row components ───────────────────────────────────────────────────────────

function SectionRow({
  section,
  selected,
  onToggle,
}: {
  section: SectionNode
  selected: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-3 pl-12 pr-4 min-h-[44px] py-2 hover:bg-accent/40 cursor-pointer">
      <Checkbox checked={selected} onChange={onToggle} />
      <span className="text-sm text-muted-foreground">{section.text}</span>
    </label>
  )
}

function ChapterRow({
  chapter,
  expanded,
  onToggleExpand,
  checkState,
  onToggleCheck,
  selectedNodeIds,
  onToggleSection,
}: {
  chapter: ChapterNode
  expanded: boolean
  onToggleExpand: () => void
  checkState: "checked" | "unchecked" | "indeterminate"
  onToggleCheck: () => void
  selectedNodeIds: Set<string>
  onToggleSection: (id: string) => void
}) {
  const hasSections = chapter.sections.length > 0
  return (
    <>
      <div className="flex items-center gap-3 pl-6 pr-4 min-h-[44px] py-2 hover:bg-accent/40">
        <Checkbox
          checked={checkState === "checked"}
          indeterminate={checkState === "indeterminate"}
          onChange={onToggleCheck}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
          disabled={!hasSections}
        >
          <span className="text-sm font-medium truncate">{chapter.text}</span>
          {chapter.sections.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              ({chapter.sections.length})
            </span>
          )}
          {hasSections && (
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-muted-foreground ml-auto transition-transform",
                expanded && "rotate-90"
              )}
            />
          )}
        </button>
      </div>

      {expanded && hasSections && chapter.sections.map((s) => (
        <SectionRow
          key={s.id}
          section={s}
          selected={selectedNodeIds.has(s.id)}
          onToggle={() => onToggleSection(s.id)}
        />
      ))}
    </>
  )
}

function BookRow({
  book,
  expanded,
  onToggleExpand,
  bookCheckState,
  onToggleBook,
  expandedChapters,
  onToggleChapterExpand,
  selectedNodeIds,
  getChapterState,
  onToggleChapter,
  onToggleSection,
}: {
  book: BookTree
  expanded: boolean
  onToggleExpand: () => void
  bookCheckState: "checked" | "unchecked" | "indeterminate"
  onToggleBook: () => void
  expandedChapters: Set<string>
  onToggleChapterExpand: (id: string) => void
  selectedNodeIds: Set<string>
  getChapterState: (ch: ChapterNode) => "checked" | "unchecked" | "indeterminate"
  onToggleChapter: (ch: ChapterNode) => void
  onToggleSection: (id: string) => void
}) {
  return (
    <div>
      {/* Book header */}
      <div className="flex items-center gap-3 px-4 min-h-[48px] py-2 bg-muted/30 hover:bg-muted/50 border-b border-border">
        <Checkbox
          checked={bookCheckState === "checked"}
          indeterminate={bookCheckState === "indeterminate"}
          onChange={onToggleBook}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          <BookOpen className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold truncate">{book.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            ({book.chapters.length} {book.chapters.length === 1 ? "chapter" : "chapters"})
          </span>
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground ml-auto transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>
      </div>

      {/* Chapters */}
      {expanded && (
        book.chapters.length === 0 ? (
          <p className="pl-6 py-3 text-xs text-muted-foreground">No chapters in this book.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {book.chapters.map((ch) => (
              <ChapterRow
                key={ch.id}
                chapter={ch}
                expanded={expandedChapters.has(ch.id)}
                onToggleExpand={() => onToggleChapterExpand(ch.id)}
                checkState={getChapterState(ch)}
                onToggleCheck={() => onToggleChapter(ch)}
                selectedNodeIds={selectedNodeIds}
                onToggleSection={onToggleSection}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Step1ContentPicker() {
  const { books, setBooks, selectedNodeIds, setSelectedNodeIds, goNext } = useWizard()
  const [loading, setLoading] = useState(!books.length)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set())
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (books.length) return
    fetch("/api/educator/exams/books")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setBooks(json.books)
        if (json.books.length > 0) {
          setExpandedBooks(new Set([json.books[0].id]))
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [books.length, setBooks])

  const trees: BookTree[] = useMemo(
    () => books.map((b) => ({ id: b.id, title: b.title, chapters: parseTree(b.blocks) })),
    [books]
  )

  const filteredTrees = useMemo(() => filterTree(trees, search), [trees, search])

  // ── Selection helpers ────────────────────────────────────────────────────

  function getChapterState(ch: ChapterNode): "checked" | "unchecked" | "indeterminate" {
    if (ch.sections.length === 0) return selectedNodeIds.has(ch.id) ? "checked" : "unchecked"
    const n = ch.sections.filter((s) => selectedNodeIds.has(s.id)).length
    if (n === 0) return "unchecked"
    if (n === ch.sections.length) return "checked"
    return "indeterminate"
  }

  function getBookState(book: BookTree): "checked" | "unchecked" | "indeterminate" {
    const all = book.chapters.flatMap((ch) => ch.sections.length ? ch.sections.map((s) => s.id) : [ch.id])
    if (all.length === 0) return "unchecked"
    const n = all.filter((id) => selectedNodeIds.has(id)).length
    if (n === 0) return "unchecked"
    if (n === all.length) return "checked"
    return "indeterminate"
  }

  function toggleChapter(ch: ChapterNode) {
    const next = new Set(selectedNodeIds)
    const state = getChapterState(ch)
    if (state === "checked") {
      next.delete(ch.id)
      ch.sections.forEach((s) => next.delete(s.id))
    } else {
      if (ch.sections.length === 0) {
        next.add(ch.id)
      } else {
        ch.sections.forEach((s) => next.add(s.id))
      }
    }
    setSelectedNodeIds(next)
  }

  function toggleSection(id: string) {
    const next = new Set(selectedNodeIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedNodeIds(next)
  }

  function toggleBook(book: BookTree) {
    const next = new Set(selectedNodeIds)
    const state = getBookState(book)
    const all = book.chapters.flatMap((ch) => ch.sections.length ? ch.sections.map((s) => s.id) : [ch.id])
    if (state === "checked") {
      all.forEach((id) => next.delete(id))
    } else {
      all.forEach((id) => next.add(id))
    }
    setSelectedNodeIds(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading your books…</p>
    </div>
  )

  if (error) return (
    <div className="text-center py-12">
      <p className="text-sm text-destructive">{error}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Select Content</h2>
        <p className="text-sm text-muted-foreground">
          Choose the chapters and sections to include in this exam.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters and sections…"
          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
        />
      </div>

      {/* Tree */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {filteredTrees.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            {books.length === 0
              ? "No books yet. Create a book first."
              : "No results match your search."}
          </div>
        ) : (
          filteredTrees.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              expanded={expandedBooks.has(book.id)}
              onToggleExpand={() => {
                const next = new Set(expandedBooks)
                next.has(book.id) ? next.delete(book.id) : next.add(book.id)
                setExpandedBooks(next)
              }}
              bookCheckState={getBookState(book)}
              onToggleBook={() => toggleBook(book)}
              expandedChapters={expandedChapters}
              onToggleChapterExpand={(id) => {
                const next = new Set(expandedChapters)
                next.has(id) ? next.delete(id) : next.add(id)
                setExpandedChapters(next)
              }}
              selectedNodeIds={selectedNodeIds}
              getChapterState={getChapterState}
              onToggleChapter={toggleChapter}
              onToggleSection={toggleSection}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {selectedNodeIds.size === 0
            ? "Select at least one chapter or section to continue."
            : `${selectedNodeIds.size} ${selectedNodeIds.size === 1 ? "item" : "items"} selected`}
        </p>
        <Button onClick={goNext} disabled={selectedNodeIds.size === 0}>
          Continue
        </Button>
      </div>
    </div>
  )
}
