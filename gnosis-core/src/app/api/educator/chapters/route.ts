import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: chapters, error, count } = await supabase
    .from("chapters")
    .select("id, name, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("[chapters GET]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch doc counts + storage per chapter in one query
  const chapterIds = (chapters ?? []).map((c) => c.id)
  let statsMap: Record<string, { doc_count: number; storage_bytes: number }> = {}

  if (chapterIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("chapter_id, total_bytes")
      .in("chapter_id", chapterIds)

    for (const d of docs ?? []) {
      if (!d.chapter_id) continue
      const s = statsMap[d.chapter_id] ?? { doc_count: 0, storage_bytes: 0 }
      s.doc_count += 1
      s.storage_bytes += d.total_bytes ?? 0
      statsMap[d.chapter_id] = s
    }
  }

  // Total storage used by this educator (all chapter docs)
  const { data: storageTotals } = await supabase
    .from("documents")
    .select("total_bytes")
    .eq("owner_id", user.id)
    .not("chapter_id", "is", null)

  const totalStorageUsed = (storageTotals ?? []).reduce((acc, d) => acc + (d.total_bytes ?? 0), 0)

  // Monthly upload count (current calendar month)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: monthlyCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .not("chapter_id", "is", null)
    .gte("created_at", monthStart.toISOString())

  const enriched = (chapters ?? []).map((c) => ({
    ...c,
    doc_count: statsMap[c.id]?.doc_count ?? 0,
    storage_bytes: statsMap[c.id]?.storage_bytes ?? 0,
  }))

  return NextResponse.json({
    chapters: enriched,
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
    total_storage_used: totalStorageUsed,
    monthly_uploads_used: monthlyCount ?? 0,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getEducator(supabase)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as { name?: string }
  const name = body.name?.trim() ?? ""

  if (!name) return NextResponse.json({ error: "Chapter name is required." }, { status: 400 })
  if (name.length > 120) return NextResponse.json({ error: "Chapter name must be 120 characters or fewer." }, { status: 400 })

  const { data, error } = await supabase
    .from("chapters")
    .insert({ user_id: user.id, name })
    .select("id, name, created_at")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A chapter with this name already exists." }, { status: 409 })
    }
    console.error("[chapters POST]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chapter: data }, { status: 201 })
}
