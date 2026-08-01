import { createClient } from "@/lib/supabase/server"
import { getEffectiveLimits } from "@/lib/platform-settings"
import { NextResponse } from "next/server"

const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"]

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chapterId } = await params
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify chapter belongs to this user
  const { data: chapter, error: chapErr } = await supabase
    .from("chapters")
    .select("id, user_id")
    .eq("id", chapterId)
    .single()

  if (chapErr || !chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 })
  if (chapter.user_id !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 })

  const body = await request.json() as { filename: string; size: number; mimeType: string }
  const { filename, size, mimeType } = body

  if (!ACCEPTED_MIME.includes(mimeType)) {
    return NextResponse.json({ error: "Only PDF and images (PNG, JPG, WebP) are accepted." }, { status: 400 })
  }

  const limits = await getEffectiveLimits(user.id)

  // 1. Per-file size check
  if (size > limits.doc_size_limit_bytes) {
    const mb = (limits.doc_size_limit_bytes / 1024 / 1024).toFixed(0)
    return NextResponse.json({ error: `File exceeds the ${mb} MB per-file limit.` }, { status: 413 })
  }

  // 2. Docs-per-chapter check
  const { count: chapterDocCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)

  if ((chapterDocCount ?? 0) >= limits.max_docs_per_chapter) {
    return NextResponse.json(
      { error: `This chapter has reached the maximum of ${limits.max_docs_per_chapter} documents.` },
      { status: 429 }
    )
  }

  // 3. Total storage check
  const { data: storageTotals } = await supabase
    .from("documents")
    .select("total_bytes")
    .eq("owner_id", user.id)
    .not("chapter_id", "is", null)

  const usedBytes = (storageTotals ?? []).reduce((acc, d) => acc + (d.total_bytes ?? 0), 0)
  if (usedBytes + size > limits.storage_limit_bytes) {
    const limitMb = (limits.storage_limit_bytes / 1024 / 1024).toFixed(0)
    return NextResponse.json(
      { error: `Upload would exceed your ${limitMb} MB total storage limit.` },
      { status: 429 }
    )
  }

  // 4. Monthly upload count check
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .not("chapter_id", "is", null)
    .gte("created_at", monthStart.toISOString())

  if ((monthlyCount ?? 0) >= limits.monthly_upload_limit) {
    return NextResponse.json(
      { error: `Monthly upload limit of ${limits.monthly_upload_limit} documents reached.` },
      { status: 429 }
    )
  }

  const ext = filename.split(".").pop() ?? "bin"
  const storagePath = `${user.id}/${crypto.randomUUID()}/original.${ext}`

  const { data: signed, error: signErr } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(storagePath)

  if (signErr || !signed) {
    return NextResponse.json({ error: "Failed to create upload URL." }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, token: signed.token, storagePath })
}
