import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function getEducator(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active")
    .eq("id", user.id)
    .single()
  if (
    profile?.role !== "educator_parent" ||
    profile.account_status !== "approved" ||
    profile.is_active === false
  ) return null
  return user
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: chapter, error } = await supabase
    .from("chapters")
    .select("id, name, created_at, user_id")
    .eq("id", id)
    .single()

  if (error || !chapter) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (chapter.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  return NextResponse.json({ chapter })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: chapter, error: fetchErr } = await supabase
    .from("chapters")
    .select("id, user_id")
    .eq("id", id)
    .single()

  if (fetchErr || !chapter) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (chapter.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  // Collect storage paths before cascade-delete
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path, markdown_path")
    .eq("chapter_id", id)

  // Delete physical files from Supabase Storage
  const paths: string[] = []
  for (const d of docs ?? []) {
    if (d.storage_path) paths.push(d.storage_path)
    if (d.markdown_path) paths.push(d.markdown_path)
  }
  if (paths.length > 0) {
    await supabase.storage.from("documents").remove(paths)
  }

  // Delete chapter — cascades to documents and document_chunks via FK
  const { error: delErr } = await supabase.from("chapters").delete().eq("id", id)
  if (delErr) {
    console.error("[chapters DELETE]", delErr.message)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
