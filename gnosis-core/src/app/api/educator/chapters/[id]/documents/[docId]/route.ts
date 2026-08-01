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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: chapterId, docId } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, owner_id, chapter_id, storage_path, markdown_path")
    .eq("id", docId)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (doc.owner_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  if (doc.chapter_id !== chapterId) return NextResponse.json({ error: "Document does not belong to this chapter." }, { status: 400 })

  // Remove storage files
  const paths = [doc.storage_path, doc.markdown_path].filter(Boolean) as string[]
  if (paths.length > 0) {
    await supabase.storage.from("documents").remove(paths)
  }

  // Delete document record (chunks cascade via FK)
  const { error: delErr } = await supabase.from("documents").delete().eq("id", docId)
  if (delErr) {
    console.error("[chapter-doc DELETE]", delErr.message)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
