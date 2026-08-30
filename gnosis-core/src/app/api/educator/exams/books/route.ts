import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, blocks")
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    books: (books ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      blocks: b.blocks ?? [],
    })),
  })
}
