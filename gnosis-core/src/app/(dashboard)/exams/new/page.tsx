import type { Metadata } from "next"
import { ExamWizard } from "@/components/exams/exam-wizard"

export const metadata: Metadata = { title: "New Exam" }

export default function NewExamPage() {
  return <ExamWizard />
}
