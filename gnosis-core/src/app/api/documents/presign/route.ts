import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { STORAGE_LIMITS } from "@/types"

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

  // Load user profile for tier + current usage
  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("tier, storage_used_bytes")
    .eq("id", user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 })
  }

  const limits = STORAGE_LIMITS[profile.tier as keyof typeof STORAGE_LIMITS]

  if (size > limits.perUpload) {
    const mb = limits.perUpload / 1024 / 1024
    return NextResponse.json(
      { error: `File exceeds the ${mb} MB per-upload limit for your plan.` },
      { status: 413 }
    )
  }

  if (profile.storage_used_bytes + size > limits.total) {
    const used = (profile.storage_used_bytes / 1024 / 1024).toFixed(1)
    const total = limits.total / 1024 / 1024
    return NextResponse.json(
      { error: `Storage full (${used} MB / ${total} MB used). Upgrade to Pro for more.` },
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
