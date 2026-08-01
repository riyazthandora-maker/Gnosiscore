import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { waitUntil } from "@vercel/functions"
import { NextResponse } from "next/server"

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const MIME_MAP: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
}
const PAGE_SIZE = 15

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: chapter } = await supabase
    .from("chapters")
    .select("user_id")
    .eq("id", chapterId)
    .single()

  if (!chapter) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (chapter.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from("documents")
    .select("id, file_name, total_bytes, processing_status, chunk_count, created_at", { count: "exact" })
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("[chapter-documents GET]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ documents: data, total: count ?? 0, page, page_size: PAGE_SIZE })
}

export const maxDuration = 300

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params
  try {
    const supabase = await createClient()
    const user = await getEducator(supabase)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: chapter } = await supabase
      .from("chapters")
      .select("user_id")
      .eq("id", chapterId)
      .single()

    if (!chapter) return NextResponse.json({ error: "Not found." }, { status: 404 })
    if (chapter.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

    const body = await request.json() as { fileName: string; storagePath: string; totalBytes: number }
    const { fileName, storagePath, totalBytes } = body

    if (!fileName || !storagePath || !totalBytes) {
      return NextResponse.json({ error: "fileName, storagePath, and totalBytes are required." }, { status: 400 })
    }

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        owner_id: user.id,
        chapter_id: chapterId,
        file_name: fileName,
        storage_path: storagePath,
        total_bytes: totalBytes,
        processing_status: "processing",
      })
      .select()
      .single()

    if (docErr || !doc) {
      console.error("[chapter-documents POST] DB insert failed:", docErr?.message)
      return NextResponse.json({ error: docErr?.message ?? "Failed to save document record." }, { status: 500 })
    }

    waitUntil(
      runPipeline(doc.id, storagePath, fileName).catch((err) => {
        console.error(`[pipeline] document ${doc.id} failed:`, (err as Error)?.message ?? err)
      })
    )

    return NextResponse.json({ document: doc }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[chapter-documents POST] unhandled error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function runPipeline(docId: string, storagePath: string, fileName: string) {
  const supabase = createAdminClient()
  const tag = `[pipeline:${docId.slice(0, 8)}]`
  try {
    const [{ pdfToMarkdown, imageToMarkdown }, { chunkMarkdown, embedAndStore }] =
      await Promise.all([
        import("@/lib/pipeline/pdf-to-markdown"),
        import("@/lib/ai/embeddings"),
      ])

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(storagePath)
    if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? ""
    const isImage = IMAGE_EXTS.has(`.${ext}`)

    let markdown: string
    if (isImage) {
      const result = await imageToMarkdown(buffer, fileName, MIME_MAP[ext] ?? "image/png")
      markdown = result.markdown
    } else {
      const result = await pdfToMarkdown(buffer, fileName)
      markdown = result.markdown
    }

    const mdPath = storagePath.replace(/\.[^.]+$/, ".md")
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(mdPath, new Blob([markdown], { type: "text/markdown" }), { upsert: true, contentType: "text/markdown" })
    if (upErr) throw new Error(`Markdown upload failed: ${upErr.message}`)

    const chunks = chunkMarkdown(markdown)
    const chunkCount = await embedAndStore(docId, chunks, supabase)

    await supabase.from("documents").update({
      markdown_path: mdPath,
      chunk_count: chunkCount,
      processing_status: "ready",
    }).eq("id", docId)

    console.log(`${tag} done — status=ready`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${tag} FAILED:`, message)
    await supabase.from("documents").update({ processing_status: "failed" }).eq("id", docId)
    throw err
  }
}
