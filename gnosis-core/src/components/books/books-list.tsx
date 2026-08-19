"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookMarked, Crown, Edit2, Eye, Loader2, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { BookRole, BookSummary } from "@/types/book"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso))
}

const ROLE_ICON: Record<BookRole, React.ReactNode> = {
  owner: <Crown className="size-3" />,
  editor: <Edit2 className="size-3" />,
  viewer: <Eye className="size-3" />,
}

const ROLE_LABEL: Record<BookRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
}

const ROLE_CLASS: Record<BookRole, string> = {
  owner: "bg-primary/10 text-primary",
  editor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  viewer: "bg-muted text-muted-foreground",
}

export function BooksList() {
  const router = useRouter()
  const [books, setBooks] = useState<BookSummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/books")
      .then((r) => r.json())
      .then(({ books: data }) => {
        setBooks(data ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function createBook() {
    setCreating(true)
    try {
      const res = await fetch("/api/books", { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      const { book } = await res.json()
      router.push(`/books/${book.id}`)
    } catch {
      setCreating(false)
    }
  }

  async function deleteBook(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setBooks((prev) => prev.filter((b) => b.id !== id))
    await fetch(`/api/books/${id}`, { method: "DELETE" })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Author and organize your curriculum as structured textbooks.
          </p>
        </div>
        <Button onClick={createBook} size="sm" disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          New Book
        </Button>
      </div>

      {!loaded ? null : books.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <BookMarked className="mb-4 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No books yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Create your first book to get started.
          </p>
          <Button onClick={createBook} size="sm" className="mt-4" disabled={creating}>
            <Plus className="size-4" />
            New Book
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5",
                "hover:border-primary/30 hover:shadow-sm transition-all",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <BookMarked className="mt-0.5 size-5 shrink-0 text-primary/70" />
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    ROLE_CLASS[book.role],
                  )}>
                    {ROLE_ICON[book.role]}
                    {ROLE_LABEL[book.role]}
                  </span>
                  {book.role === "owner" && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      onClick={(e) => deleteBook(book.id, e)}
                      title="Delete book"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold leading-tight line-clamp-2">
                  {book.title || "Untitled Book"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {book.blockCount} {book.blockCount === 1 ? "block" : "blocks"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Updated {formatDate(book.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
