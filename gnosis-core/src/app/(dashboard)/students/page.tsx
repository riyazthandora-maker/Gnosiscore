import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { StudentsClient } from "@/components/students/students-client"
import type { StudentGrade } from "@/types"

export const metadata: Metadata = { title: "Students" }

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: gradesData } = await supabase
    .from("student_grades")
    .select("id, name, teacher_id, created_at")
    .eq("teacher_id", user!.id)
    .order("name")

  const initialGrades = (gradesData ?? []) as StudentGrade[]

  return <StudentsClient initialGrades={initialGrades} />
}
