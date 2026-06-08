import { createClient } from "@/lib/supabase/server"
import { pdfToMarkdown, imageToMarkdown } from "@/lib/pipeline/pdf-to-markdown"
import { chunkMarkdown, embedAndStore } from "@/lib/ai/embeddings"
import { NextResponse } from "next/server"

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const MIME_MAP: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
}

// Retry endpoint — re-runs the full pipeline for a failed document
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_name, storage_path, owner_id, processing_status")
    .eq("id", id)
    .single()

  if (!doc || doc.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  if (doc.processing_status === "ready") {
    return NextResponse.json({ status: "already_ready" })
  }
  if (doc.processing_status === "processing") {
    return NextResponse.json({ error: "Already processing." }, { status: 409 })
  }

  // Mark as processing before starting
  await supabase.from("documents").update({ processing_status: "processing" }).eq("id", id)

  try {
    // Download raw file
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path)

    if (dlErr || !fileData) throw new Error("Failed to download file from storage.")

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = doc.storage_path.split(".").pop()?.toLowerCase() ?? ""
    const isImage = IMAGE_EXTS.has(`.${ext}`)

    let markdown: string
    if (isImage) {
      const result = await imageToMarkdown(buffer, doc.file_name, MIME_MAP[ext] ?? "image/png")
      markdown = result.markdown
    } else {
      const result = await pdfToMarkdown(buffer, doc.file_name)
      markdown = result.markdown
    }

    const mdPath = doc.storage_path.replace(/\.[^.]+$/, ".md")
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(mdPath, new Blob([markdown], { type: "text/markdown" }), {
        upsert: true,
        contentType: "text/markdown",
      })

    if (upErr) throw new Error(`Markdown upload failed: ${upErr.message}`)

    // Clear old chunks before re-embedding
    await supabase.from("document_chunks").delete().eq("document_id", id)

    const chunks = chunkMarkdown(markdown)
    const chunkCount = await embedAndStore(id, chunks, supabase)

    await supabase.from("documents").update({
      markdown_path: mdPath,
      chunk_count: chunkCount,
      processing_status: "ready",
    }).eq("id", id)

    return NextResponse.json({ status: "ready", chunk_count: chunkCount })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed."
    console.error(`[pipeline] retry for document ${id} failed:`, message)
    await supabase.from("documents").update({ processing_status: "failed" }).eq("id", id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
