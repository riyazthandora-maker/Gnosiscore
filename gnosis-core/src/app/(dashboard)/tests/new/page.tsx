import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TestConfigForm } from "@/components/quiz/test-config-form"

export const metadata: Metadata = { title: "New test" }

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<{ docId?: string }>
}) {
  const { docId } = await searchParams
  if (!docId) redirect("/documents")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("id", docId)
    .eq("user_id", user.id)
    .single()

  if (!doc || doc.status !== "ready") redirect("/documents")

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">New test from</p>
        <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
      </div>
      <TestConfigForm documentId={doc.id} />
    </div>
  )
}
