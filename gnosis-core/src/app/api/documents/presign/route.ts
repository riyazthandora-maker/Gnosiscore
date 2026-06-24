import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/lib/platform-settings"

const ACCEPTED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as { filename: string; size: number; mimeType: string }
  const { filename, size, mimeType } = body

  if (!ACCEPTED_MIME.includes(mimeType)) {
    return NextResponse.json({ error: "Only PDF and images are accepted." }, { status: 400 })
  }

  const { file_size_limit_bytes } = await getPlatformSettings()
  if (size > file_size_limit_bytes) {
    const mb = (file_size_limit_bytes / 1024 / 1024).toFixed(0)
    return NextResponse.json(
      { error: `File exceeds the ${mb} MB per-file limit.` },
      { status: 413 }
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
