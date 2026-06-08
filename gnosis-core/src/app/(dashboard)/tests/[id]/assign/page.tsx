"use client"

import { useState } from "react"
import { use } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AssignResult {
  assigned: number
  not_found: string[]
}

export default function AssignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [emails, setEmails] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [result, setResult] = useState<AssignResult | null>(null)

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const emailList = emails
        .split(/[\n,;]/)
        .map((e) => e.trim())
        .filter(Boolean)

      if (emailList.length === 0) throw new Error("Enter at least one email address.")

      const res = await fetch(`/api/educator/tests/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailList,
          due_at: dueAt || undefined,
        }),
      })
      if (!res.ok) { const { error: e } = await res.json(); throw new Error(e) }
      return res.json() as Promise<AssignResult>
    },
    onSuccess: (data) => {
      setResult(data)
    },
  })

  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-green-500/10">
              <CheckCircle2 className="size-7 text-green-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold">Test assigned</h2>
            <p className="text-sm text-muted-foreground">
              Assigned to {result.assigned} student{result.assigned !== 1 ? "s" : ""}.
            </p>
          </div>

          {result.not_found.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium mb-1">These emails weren't found:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.not_found.map((e) => <li key={e}>{e}</li>)}
              </ul>
              <p className="mt-2">Students need to register first before they can be assigned tests.</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => { setResult(null); setEmails("") }}>Assign more students</Button>
            <Button variant="ghost" onClick={() => router.push(`/tests/${id}`)}>Back to test</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assign test</h1>
        <p className="text-muted-foreground">Enter student email addresses to send them this test.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0" />
          <p>Students must have a registered GnosisCore account. The test will be published automatically.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Student emails</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={"student1@example.com\nstudent2@example.com"}
            rows={5}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <p className="text-xs text-muted-foreground">One email per line, or comma/semicolon separated.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Due date <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error instanceof Error ? error.message : "Something went wrong."}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => router.push(`/tests/${id}`)}>Cancel</Button>
          <Button disabled={isPending || !emails.trim()} onClick={() => mutate()} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
            Assign
          </Button>
        </div>
      </div>
    </div>
  )
}
