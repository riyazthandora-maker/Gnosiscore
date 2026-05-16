import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: attempt, error: aErr } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single()

  if (aErr || !attempt) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (attempt.status !== "completed") return NextResponse.json({ error: "Attempt not yet complete." }, { status: 409 })

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("seq_number")

  const { data: responses } = await supabase
    .from("responses")
    .select("*")
    .eq("attempt_id", attemptId)

  return NextResponse.json({ attempt, questions, responses })
}
