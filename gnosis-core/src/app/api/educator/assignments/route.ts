import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendTestAssignmentEmail } from "@/lib/email/send-test-assignment"

// GET  /api/educator/assignments?paper_id=...
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const paperId = new URL(req.url).searchParams.get("paper_id")

  let query = supabase
    .from("exam_assignments")
    .select(`
      *,
      exam_papers ( id, title ),
      student_roster ( id, name, email, grade:grades(name) )
    `)
    .eq("assigned_by", user.id)
    .order("assigned_at", { ascending: false })

  if (paperId) query = query.eq("paper_id", paperId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ assignments: data ?? [] })
}

// POST /api/educator/assignments
// Body: { paper_ids: string[], student_roster_ids: string[], config: object }
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { paper_ids, student_roster_ids, config } = body as {
    paper_ids: string[]
    student_roster_ids: string[]
    config: Record<string, unknown>
  }

  if (!paper_ids?.length) return NextResponse.json({ error: "No exams selected" }, { status: 400 })
  if (!student_roster_ids?.length) return NextResponse.json({ error: "No students selected" }, { status: 400 })

  // Build rows (cross product of papers × students)
  const rows = paper_ids.flatMap(paper_id =>
    student_roster_ids.map(student_roster_id => ({
      paper_id,
      student_roster_id,
      assigned_by: user.id,
      ...sanitizeConfig(config),
    }))
  )

  // Upsert so re-assigning updates config rather than erroring
  const { data: inserted, error } = await supabase
    .from("exam_assignments")
    .upsert(rows, { onConflict: "paper_id,student_roster_id", ignoreDuplicates: false })
    .select("id, paper_id, student_roster_id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch educator profile for email
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()
  const teacherName = (profile as { full_name?: string } | null)?.full_name ?? "Your teacher"

  // Fetch student roster entries for emails
  const { data: rosterEntries } = await supabase
    .from("student_roster")
    .select("id, name, email")
    .in("id", student_roster_ids)

  // Fetch paper titles for emails
  const { data: papers } = await supabase
    .from("exam_papers")
    .select("id, title")
    .in("id", paper_ids)

  const paperMap = Object.fromEntries((papers ?? []).map(p => [p.id as string, p.title as string]))
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  // Fire-and-forget emails
  if (rosterEntries && inserted) {
    for (const assignment of inserted) {
      const student = rosterEntries.find(r => r.id === assignment.student_roster_id)
      const paperTitle = paperMap[assignment.paper_id as string] ?? "a test"
      if (student?.email) {
        sendTestAssignmentEmail({
          studentEmail: student.email as string,
          studentName: student.name as string,
          teacherName,
          examTitle: paperTitle,
          lobbyUrl: `${appUrl}/student/exam/${assignment.id}`,
        }).catch(() => { /* non-critical */ })
      }
    }
  }

  return NextResponse.json({ count: inserted?.length ?? 0 })
}

function sanitizeConfig(cfg: Record<string, unknown>) {
  return {
    duration_minutes:            num(cfg.duration_minutes, 20),
    starts_at:                   cfg.starts_at ?? null,
    ends_at:                     cfg.ends_at ?? null,
    max_attempts:                num(cfg.max_attempts, 3),
    randomize_questions:         bool(cfg.randomize_questions, false),
    shuffle_answers:             bool(cfg.shuffle_answers, false),
    allow_backtrack:             bool(cfg.allow_backtrack, true),
    mandatory_answering:         bool(cfg.mandatory_answering, false),
    flag_for_review:             bool(cfg.flag_for_review, true),
    browser_lockdown:            bool(cfg.browser_lockdown, false),
    disable_copy_paste:          bool(cfg.disable_copy_paste, false),
    tab_switch_warnings:         bool(cfg.tab_switch_warnings, false),
    tab_switch_limit:            num(cfg.tab_switch_limit, 3),
    release_results_immediately: bool(cfg.release_results_immediately, true),
    show_explanations:           bool(cfg.show_explanations, true),
    threshold_excellent:         num(cfg.threshold_excellent, 90),
    threshold_distinction:       num(cfg.threshold_distinction, 80),
    threshold_pass:              num(cfg.threshold_pass, 70),
  }
}

const num = (v: unknown, def: number) => (typeof v === "number" ? v : def)
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def)
