import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book } = await supabase
    .from("books")
    .select("owner_id")
    .eq("id", id)
    .single()

  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (book.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { role } = await req.json() as { role: "editor" | "viewer" }
  if (!["editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("book_collaborators")
    .update({ role })
    .eq("book_id", id)
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: book } = await supabase
    .from("books")
    .select("owner_id")
    .eq("id", id)
    .single()

  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (book.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("book_collaborators")
    .delete()
    .eq("book_id", id)
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
