"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, BrainCircuit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Toughness, ShowAnswerMode } from "@/types"

const TOUGHNESS_OPTIONS: { value: Toughness; label: string; desc: string }[] = [
  { value: "easy", label: "Easy", desc: "Recall & basic comprehension" },
  { value: "medium", label: "Medium", desc: "Application & interpretation" },
  { value: "hard", label: "Hard", desc: "Analysis & synthesis" },
  { value: "advanced", label: "Advanced", desc: "Expert-level reasoning" },
]

const ANSWER_MODE_OPTIONS: { value: ShowAnswerMode; label: string; desc: string }[] = [
  { value: "immediate", label: "Immediate", desc: "Show correct answer after each question" },
  { value: "end", label: "At end", desc: "Reveal all answers on the results page" },
  { value: "hidden", label: "Hidden", desc: "Score only — no answers revealed" },
]

interface Props { documentId: string }

export function TestConfigForm({ documentId }: Props) {
  const router = useRouter()
  const [toughness, setToughness] = useState<Toughness>("medium")
  const [totalQuestions, setTotalQuestions] = useState(10)
  const [enableTotalTime, setEnableTotalTime] = useState(false)
  const [totalTimeMins, setTotalTimeMins] = useState(15)
  const [enablePerQuestion, setEnablePerQuestion] = useState(false)
  const [perQuestionSecs, setPerQuestionSecs] = useState(60)
  const [answerMode, setAnswerMode] = useState<ShowAnswerMode>("end")
  const [topicFilter, setTopicFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch("/api/tests/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        toughness,
        total_questions: totalQuestions,
        total_time_secs: enableTotalTime ? totalTimeMins * 60 : null,
        per_question_secs: enablePerQuestion ? perQuestionSecs : null,
        show_answer_mode: answerMode,
        topic_filter: topicFilter.trim()
          ? topicFilter.split(",").map((t) => t.trim()).filter(Boolean)
          : null,
        config_name: null,
      }),
    })

    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg)
      setLoading(false)
      return
    }

    const { attempt_id } = await res.json()
    router.push(`/test/${attempt_id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Toughness */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Difficulty</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOUGHNESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setToughness(opt.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                toughness === opt.value
                  ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              )}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Question count */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          Number of questions — <span className="text-primary">{totalQuestions}</span>
        </legend>
        <input
          type="range"
          min={5}
          max={50}
          step={5}
          value={totalQuestions}
          onChange={(e) => setTotalQuestions(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5</span><span>50</span>
        </div>
      </fieldset>

      {/* Timers */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Timers</p>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Total time limit</p>
              <p className="text-xs text-muted-foreground">Overall countdown for the entire test</p>
            </div>
            <input
              type="checkbox"
              checked={enableTotalTime}
              onChange={(e) => setEnableTotalTime(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>
          {enableTotalTime && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="number"
                min={1}
                max={180}
                value={totalTimeMins}
                onChange={(e) => setTotalTimeMins(Number(e.target.value))}
                className="w-20 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </motion.div>
          )}

          <div className="border-t border-border" />

          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Per-question timer</p>
              <p className="text-xs text-muted-foreground">Auto-advance when time runs out</p>
            </div>
            <input
              type="checkbox"
              checked={enablePerQuestion}
              onChange={(e) => setEnablePerQuestion(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>
          {enablePerQuestion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="number"
                min={10}
                max={300}
                step={5}
                value={perQuestionSecs}
                onChange={(e) => setPerQuestionSecs(Number(e.target.value))}
                className="w-20 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <span className="text-sm text-muted-foreground">seconds per question</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Answer visibility */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Answer visibility</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ANSWER_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswerMode(opt.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                answerMode === opt.value
                  ? "border-primary bg-primary/8 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              )}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Topic filter */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Topic filter <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <input
          type="text"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          placeholder="e.g. photosynthesis, cell division, osmosis"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <p className="text-xs text-muted-foreground">Comma-separated topics to focus the questions on.</p>
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating {totalQuestions} questions…
          </>
        ) : (
          <>
            <BrainCircuit className="size-4" />
            Generate test
          </>
        )}
      </Button>

      {loading && (
        <p className="text-center text-xs text-muted-foreground">
          This usually takes 10–30 seconds depending on document length.
        </p>
      )}
    </form>
  )
}
