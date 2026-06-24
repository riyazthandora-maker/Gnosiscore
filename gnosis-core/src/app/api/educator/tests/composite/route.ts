import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface CompositeBody {
  title: string
  description?: string
  generation_request_ids: string[]  // question banks (generation requests) to pull from
  question_count: number             // total questions to pick
  time_limit_min?: number
  allow_pause?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("role, account_status, is_active")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "educator_parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (profile?.account_status !== "approved") return NextResponse.json({ error: "Account pending approval." }, { status: 403 })
  if (profile?.is_active === false) return NextResponse.json({ error: "Account deactivated." }, { status: 403 })

  const body = await request.json() as CompositeBody
  const { title, description, generation_request_ids, question_count, time_limit_min, allow_pause } = body

  if (!title?.trim()) return NextResponse.json({ error: "title is required." }, { status: 400 })
  if (!Array.isArray(generation_request_ids) || generation_request_ids.length < 1) {
    return NextResponse.json({ error: "Select at least one question bank." }, { status: 400 })
  }
  if (!question_count || question_count < 1) {
    return NextResponse.json({ error: "question_count must be at least 1." }, { status: 400 })
  }

  // Fetch all approved questions from the selected generation requests owned by this educator
  const { data: questions, error: qErr } = await supabase
    .from("questions")
    .select("id")
    .in("generation_request_id", generation_request_ids)
    .eq("owner_id", user.id)
    .eq("status", "approved")

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "No approved questions found in the selected banks." }, { status: 400 })
  }
  if (question_count > questions.length) {
    return NextResponse.json(
      { error: `Only ${questions.length} approved questions available. Reduce question_count.` },
      { status: 400 }
    )
  }

  // Randomly pick question_count questions from the combined pool
  const shuffled = shuffleArray(questions)
  const picked = shuffled.slice(0, question_count).map((q) => q.id)

  const { data: test, error: testErr } = await supabase
    .from("tests")
    .insert({
      creator_id: user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      question_ids: picked,
      time_limit_min: time_limit_min ?? null,
      allow_pause: allow_pause ?? false,
      is_published: false,
    })
    .select("id, title, question_ids")
    .single()

  if (testErr || !test) return NextResponse.json({ error: "Failed to create test." }, { status: 500 })

  return NextResponse.json({ test }, { status: 201 })
}
