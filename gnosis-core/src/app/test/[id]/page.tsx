import { QuizPlayer } from "@/components/quiz/quiz-player"

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <QuizPlayer attemptId={id} />
}
