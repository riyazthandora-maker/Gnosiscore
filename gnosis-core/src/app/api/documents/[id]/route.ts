import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch doc first to get size + storage path
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("original_path, markdown_path, file_size_bytes, user_id")
    .eq("id", id)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (doc.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  // Remove storage files
  const toRemove = [doc.original_path, doc.markdown_path].filter(Boolean) as string[]
  if (toRemove.length) {
    await supabase.storage.from("documents").remove(toRemove)
  }

  // Delete DB record (cascade deletes configs, attempts, etc.)
  await supabase.from("documents").delete().eq("id", id)

  // Decrement storage usage
  await supabase.rpc("increment_storage", {
    p_user_id: user.id,
    p_bytes: -doc.file_size_bytes,
  })

  return new NextResponse(null, { status: 204 })
}
