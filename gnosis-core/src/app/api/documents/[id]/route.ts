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

  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("storage_path, markdown_path, owner_id")
    .eq("id", id)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (doc.owner_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  // Remove storage files (chunks cascade-delete via FK on document_chunks)
  const toRemove = [doc.storage_path, doc.markdown_path].filter(Boolean) as string[]
  if (toRemove.length) {
    await supabase.storage.from("documents").remove(toRemove)
  }

  await supabase.from("documents").delete().eq("id", id)

  return new NextResponse(null, { status: 204 })
}
