import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { FlatBlock } from "@/types/book"

function toText(blocks: FlatBlock[]): string {
  return blocks
    .map((b) => {
      if (b.level === "chapter") return `# ${b.text}`
      if (b.level === "section") return `## ${b.text}`
      return `- ${b.text}`
    })
    .join("\n")
}

function chaptersOf(blocks: FlatBlock[]) {
  return blocks
    .map((b, i) => (b.level === "chapter" ? { index: i, title: b.text } : null))
    .filter((x): x is { index: number; title: string } => x !== null)
}

function scopedBlocks(blocks: FlatBlock[], scope: string, chapterIndex: number): FlatBlock[] {
  if (scope !== "chapter") return blocks

  const starts = chaptersOf(blocks).map((c) => c.index)
  const from = starts[chapterIndex]
  if (from === undefined) return []
  const to = starts[chapterIndex + 1] ?? blocks.length
  return blocks.slice(from, to)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book, error } = await supabase
    .from("books")
    .select("id, title, blocks, owner_id")
    .eq("id", id)
    .single()

  if (error || !book) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const url = new URL(req.url)
  const scope = url.searchParams.get("scope") ?? "full"
  const chapterIndex = parseInt(url.searchParams.get("chapter") ?? "0", 10)

  const allBlocks = book.blocks as FlatBlock[]
  const selected = scopedBlocks(allBlocks, scope, chapterIndex)
  const chapters = chaptersOf(allBlocks)

  return NextResponse.json({
    bookId: book.id,
    title: book.title,
    scope,
    chapterIndex: scope === "chapter" ? chapterIndex : null,
    chapters,
    blocks: selected,
    text: toText(selected),
  })
}
