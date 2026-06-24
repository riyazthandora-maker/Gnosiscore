"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Shuffle, Loader2, CheckCircle2, ChevronLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface GenerationRequest {
  id: string
  name: string
  question_count: number
  status: string
  created_at: string
}

interface ApprovedCountMap {
  [requestId: string]: number
}

export default function CompositeTestPage() {
  const router = useRouter()
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questionCount, setQuestionCount] = useState("")
  const [timeLimitMin, setTimeLimitMin] = useState("")
  const [allowPause, setAllowPause] = useState(false)
  const [suggestingName, setSuggestingName] = useState(false)
  const [error, setError] = useState("")

  // Fetch completed generation requests (question banks)
  const { data, isLoading } = useQuery<{ requests: GenerationRequest[]; approved_counts: ApprovedCountMap }>({
    queryKey: ["question-banks-for-composite"],
    queryFn: async () => {
      const r = await fetch("/api/educator/questions/banks")
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
  })

  const banks = data?.requests ?? []
  const approvedCounts = data?.approved_counts ?? {}

  const totalAvailable = selectedBankIds.reduce((sum, id) => sum + (approvedCounts[id] ?? 0), 0)

  function toggleBank(id: string) {
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSuggestName() {
    if (selectedBankIds.length === 0) return
    setSuggestingName(true)
    try {
      const res = await fetch("/api/educator/tests/suggest-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_request_ids: selectedBankIds }),
      })
      const d = await res.json()
      if (d.name) setTitle(d.name)
    } finally {
      setSuggestingName(false)
    }
  }

  const { mutate: create, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/educator/tests/composite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          generation_request_ids: selectedBankIds,
          question_count: parseInt(questionCount, 10),
          time_limit_min: timeLimitMin ? parseInt(timeLimitMin, 10) : undefined,
          allow_pause: allowPause,
        }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: (d) => {
      router.push(`/tests/${d.test.id}`)
    },
    onError: (e) => setError(e.message),
  })

  const canCreate =
    title.trim() &&
    selectedBankIds.length > 0 &&
    questionCount &&
    parseInt(questionCount, 10) >= 1 &&
    parseInt(questionCount, 10) <= totalAvailable

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shuffle className="size-6 text-primary" />
            Random Composite Test
          </h1>
          <p className="text-muted-foreground text-sm">
            Pick questions randomly from one or more question banks.
          </p>
        </div>
      </div>

      {/* Bank picker */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          1. Select question banks
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : banks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">No completed question banks found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {banks.map((bank) => {
              const approved = approvedCounts[bank.id] ?? 0
              const selected = selectedBankIds.includes(bank.id)
              return (
                <button
                  key={bank.id}
                  type="button"
                  disabled={approved === 0}
                  onClick={() => approved > 0 && toggleBank(bank.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5"
                      : approved === 0
                      ? "border-border opacity-40 cursor-not-allowed"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  )}
                >
                  <div className={cn(
                    "size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors",
                    selected ? "border-primary bg-primary" : "border-border"
                  )}>
                    {selected && <CheckCircle2 className="size-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bank.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {approved} approved question{approved !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Config */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          2. Configure test
        </h2>

        {/* Title with suggest */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Test name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mixed Biology & Chemistry Quiz"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedBankIds.length === 0 || suggestingName}
              onClick={handleSuggestName}
              className="gap-1.5 shrink-0"
            >
              {suggestingName ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Suggest
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description of this test…"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Questions to pick</label>
            <input
              type="number"
              min={1}
              max={totalAvailable || undefined}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              placeholder={totalAvailable > 0 ? `Max ${totalAvailable}` : "Select banks first"}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            {totalAvailable > 0 && (
              <p className="text-xs text-muted-foreground">{totalAvailable} questions available across selected banks</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Time limit <span className="text-muted-foreground font-normal">(optional)</span></label>
            <div className="relative">
              <input
                type="number"
                min={1}
                value={timeLimitMin}
                onChange={(e) => setTimeLimitMin(e.target.value)}
                placeholder="No limit"
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 pr-14 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            role="checkbox"
            aria-checked={allowPause}
            onClick={() => setAllowPause((v) => !v)}
            className={cn(
              "size-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer",
              allowPause ? "border-primary bg-primary" : "border-border"
            )}
          >
            {allowPause && <CheckCircle2 className="size-3 text-primary-foreground" />}
          </div>
          <div>
            <p className="text-sm font-medium">Allow pause</p>
            <p className="text-xs text-muted-foreground">Students can pause the timer during the exam.</p>
          </div>
        </label>
      </section>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      <Button
        onClick={() => create()}
        disabled={!canCreate || isPending}
        className="w-full gap-2"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
        Create composite test
      </Button>
    </div>
  )
}
