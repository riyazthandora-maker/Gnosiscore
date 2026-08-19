import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { FlatBlock } from "@/types/book"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book, error } = await supabase
    .from("books")
    .select("id, title, blocks, owner_id, created_at, updated_at")
    .eq("id", id)
    .single()

  if (error || !book) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let role: string
  if (book.owner_id === user.id) {
    role = "owner"
  } else {
    const { data: collab } = await supabase
      .from("book_collaborators")
      .select("role")
      .eq("book_id", id)
      .eq("user_id", user.id)
      .single()
    role = collab?.role ?? "viewer"
  }

  return NextResponse.json({
    book: {
      id: book.id,
      title: book.title,
      blocks: book.blocks,
      owner_id: book.owner_id,
      role,
      createdAt: book.created_at,
      updatedAt: book.updated_at,
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book } = await supabase
    .from("books")
    .select("owner_id")
    .eq("id", id)
    .single()

  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (book.owner_id !== user.id) {
    const { data: collab } = await supabase
      .from("book_collaborators")
      .select("role")
      .eq("book_id", id)
      .eq("user_id", user.id)
      .single()
    if (!collab || collab.role !== "editor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const body = await req.json() as { title?: string; blocks?: FlatBlock[] }

  const { data: updated, error } = await supabase
    .from("books")
    .update({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.blocks !== undefined ? { blocks: body.blocks } : {}),
    })
    .eq("id", id)
    .select("id, title, blocks, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ book: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book } = await supabase
    .from("books")
    .select("owner_id")
    .eq("id", id)
    .single()

  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (book.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await supabase.from("books").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
