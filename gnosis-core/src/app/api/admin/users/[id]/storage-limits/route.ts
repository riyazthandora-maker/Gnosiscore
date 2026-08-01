import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return null
  return user
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from("users")
    .select("storage_limit_bytes, doc_size_limit_bytes, max_docs_per_chapter, monthly_upload_limit")
    .eq("id", userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ limits: data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    storage_limit_bytes?: number | null
    doc_size_limit_bytes?: number | null
    max_docs_per_chapter?: number | null
    monthly_upload_limit?: number | null
  }

  const updates: Record<string, number | null> = {}

  if ("storage_limit_bytes" in body) {
    const v = body.storage_limit_bytes
    if (v !== null && (typeof v !== "number" || v < 1024 * 1024)) {
      return NextResponse.json({ error: "storage_limit_bytes must be at least 1 MB or null." }, { status: 400 })
    }
    updates.storage_limit_bytes = v ?? null
  }

  if ("doc_size_limit_bytes" in body) {
    const v = body.doc_size_limit_bytes
    if (v !== null && (typeof v !== "number" || v < 1024 * 1024)) {
      return NextResponse.json({ error: "doc_size_limit_bytes must be at least 1 MB or null." }, { status: 400 })
    }
    updates.doc_size_limit_bytes = v ?? null
  }

  if ("max_docs_per_chapter" in body) {
    const v = body.max_docs_per_chapter
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 1)) {
      return NextResponse.json({ error: "max_docs_per_chapter must be a positive integer or null." }, { status: 400 })
    }
    updates.max_docs_per_chapter = v ?? null
  }

  if ("monthly_upload_limit" in body) {
    const v = body.monthly_upload_limit
    if (v !== null && (typeof v !== "number" || !Number.isInteger(v) || v < 1)) {
      return NextResponse.json({ error: "monthly_upload_limit must be a positive integer or null." }, { status: 400 })
    }
    updates.monthly_upload_limit = v ?? null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 })
  }

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("storage_limit_bytes, doc_size_limit_bytes, max_docs_per_chapter, monthly_upload_limit")
    .single()

  if (error) {
    console.error("[storage-limits PATCH]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ limits: data })
}
