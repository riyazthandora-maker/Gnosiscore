import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, blocks, owner_id, updated_at")
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: collabs } = await supabase
    .from("book_collaborators")
    .select("book_id, role")
    .eq("user_id", user.id)

  const collabMap = new Map((collabs ?? []).map((c) => [c.book_id as string, c.role as string]))

  const summaries = (books ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    blockCount: Array.isArray(b.blocks) ? (b.blocks as unknown[]).length : 0,
    updatedAt: b.updated_at,
    role: b.owner_id === user.id ? "owner" : (collabMap.get(b.id) ?? "viewer"),
  }))

  return NextResponse.json({ books: summaries })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book, error } = await supabase
    .from("books")
    .insert({ owner_id: user.id, title: "", blocks: [] })
    .select("id, title, blocks, owner_id, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ book }, { status: 201 })
}
