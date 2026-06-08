import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

export const maxDuration = 300

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const MIME_MAP: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json() as {
      fileName: string
      storagePath: string
      totalBytes: number
    }
    const { fileName, storagePath, totalBytes } = body

    if (!fileName || !storagePath || !totalBytes) {
      return NextResponse.json({ error: "fileName, storagePath, and totalBytes are required." }, { status: 400 })
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        file_name: fileName,
        storage_path: storagePath,
        total_bytes: totalBytes,
        processing_status: "processing",
      })
      .select()
      .single()

    if (docErr || !doc) {
      console.error("[documents POST] DB insert failed:", docErr?.message)
      return NextResponse.json({ error: docErr?.message ?? "Failed to save document record." }, { status: 500 })
    }

    // Keep the function alive until pipeline completes (Vercel kills on response otherwise)
    waitUntil(
      runPipeline(doc.id, storagePath, fileName).catch((err) => {
        console.error(`[pipeline] document ${doc.id} failed:`, (err as Error)?.message ?? err)
      })
    )

    return NextResponse.json({ document: doc }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[documents POST] unhandled error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function runPipeline(docId: string, storagePath: string, fileName: string) {
  const supabase = createAdminClient()
  const tag = `[pipeline:${docId.slice(0, 8)}]`
  try {
    console.log(`${tag} starting — ${fileName} (${storagePath})`)

    const [{ pdfToMarkdown, imageToMarkdown }, { chunkMarkdown, embedAndStore }] =
      await Promise.all([
        import("@/lib/pipeline/pdf-to-markdown"),
        import("@/lib/ai/embeddings"),
      ])
    console.log(`${tag} modules loaded`)

    // 1. Download raw file
    console.log(`${tag} downloading from storage`)
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(storagePath)

    if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)
    const buffer = Buffer.from(await fileData.arrayBuffer())
    console.log(`${tag} downloaded ${buffer.length} bytes`)

    const ext = storagePath.split(".").pop()?.toLowerCase() ?? ""
    const isImage = IMAGE_EXTS.has(`.${ext}`)

    // 2. Convert to Markdown
    console.log(`${tag} converting to markdown (isImage=${isImage})`)
    let markdown: string
    if (isImage) {
      const result = await imageToMarkdown(buffer, fileName, MIME_MAP[ext] ?? "image/png")
      markdown = result.markdown
    } else {
      const result = await pdfToMarkdown(buffer, fileName)
      markdown = result.markdown
    }
    console.log(`${tag} markdown ready — ${markdown.length} chars`)

    // 3. Upload Markdown to storage
    const mdPath = storagePath.replace(/\.[^.]+$/, ".md")
    console.log(`${tag} uploading markdown to ${mdPath}`)
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(mdPath, new Blob([markdown], { type: "text/markdown" }), {
        upsert: true,
        contentType: "text/markdown",
      })

    if (upErr) throw new Error(`Markdown upload failed: ${upErr.message}`)
    console.log(`${tag} markdown uploaded`)

    // 4. Chunk + embed → insert into document_chunks
    const chunks = chunkMarkdown(markdown)
    console.log(`${tag} chunked into ${chunks.length} pieces — embedding`)
    const chunkCount = await embedAndStore(docId, chunks, supabase)
    console.log(`${tag} stored ${chunkCount} chunks`)

    // 5. Mark ready
    await supabase.from("documents").update({
      markdown_path: mdPath,
      chunk_count: chunkCount,
      processing_status: "ready",
    }).eq("id", docId)
    console.log(`${tag} done — status=ready`)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`${tag} FAILED:`, message)
    if (stack) console.error(`${tag} stack:`, stack)
    await supabase.from("documents").update({ processing_status: "failed" }).eq("id", docId)
    throw err
  }
}
