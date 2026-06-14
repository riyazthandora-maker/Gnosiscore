import { redirect } from "next/navigation"

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<{ docId?: string }>
}) {
  const { docId } = await searchParams
  // Legacy route — redirect to the active generate flow, preserving the docId if present
  redirect(docId ? `/tests/generate?docId=${docId}` : "/tests/generate")
}
