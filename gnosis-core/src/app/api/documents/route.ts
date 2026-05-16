import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    title: string
    storagePath: string
    fileSizeBytes: number
  }
  const { title, storagePath, fileSizeBytes } = body

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title,
      original_path: storagePath,
      file_size_bytes: fileSizeBytes,
      status: "processing",
    })
    .select()
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: "Failed to save document record." }, { status: 500 })
  }

  // Increment user storage usage
  await supabase.rpc("increment_storage", {
    p_user_id: user.id,
    p_bytes: fileSizeBytes,
  })

  // Signal the FastAPI pipeline worker (fire-and-forget)
  const apiUrl = process.env.BACKEND_API_URL
  if (apiUrl) {
    fetch(`${apiUrl}/pipeline/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "" },
      body: JSON.stringify({ document_id: doc.id, storage_path: storagePath }),
    }).catch(() => {
      // Non-fatal — worker will pick it up via queue
    })
  }

  return NextResponse.json({ document: doc }, { status: 201 })
}
