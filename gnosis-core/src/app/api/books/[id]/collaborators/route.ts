import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
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
  if (book.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createAdminClient()
  const { data: collabs, error } = await admin
    .from("book_collaborators")
    .select("user_id, role, added_at")
    .eq("book_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!collabs?.length) return NextResponse.json({ collaborators: [] })

  const { data: users } = await admin
    .from("users")
    .select("id, email, full_name")
    .in("id", collabs.map((c) => c.user_id))

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  return NextResponse.json({
    collaborators: collabs.map((c) => ({
      user_id: c.user_id,
      email: userMap.get(c.user_id)?.email ?? "",
      full_name: userMap.get(c.user_id)?.full_name ?? "",
      role: c.role,
      added_at: c.added_at,
    })),
  })
}

export async function POST(
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
  if (book.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { email, role } = await req.json() as { email: string; role: "editor" | "viewer" }
  if (!email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 })
  if (!["editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "role must be editor or viewer" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from("users")
    .select("id, email, full_name")
    .ilike("email", email.trim())
    .single()

  if (!target) return NextResponse.json({ error: "No user found with that email" }, { status: 404 })
  if (target.id === user.id) {
    return NextResponse.json({ error: "Cannot add yourself as a collaborator" }, { status: 400 })
  }

  const { data: collab, error } = await admin
    .from("book_collaborators")
    .upsert({ book_id: id, user_id: target.id, role }, { onConflict: "book_id,user_id" })
    .select("user_id, role, added_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    collaborator: {
      user_id: collab.user_id,
      email: target.email,
      full_name: target.full_name,
      role: collab.role,
      added_at: collab.added_at,
    },
  }, { status: 201 })
}
