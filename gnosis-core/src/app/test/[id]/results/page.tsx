import { ResultsSummary } from "@/components/quiz/results-summary"

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ResultsSummary attemptId={id} />
}
