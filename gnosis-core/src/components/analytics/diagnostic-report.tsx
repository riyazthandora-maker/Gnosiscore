"use client"

import { motion, AnimatePresence } from "framer-motion"
import { BrainCircuit, Loader2, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDiagnostic, useGenerateDiagnostic } from "@/lib/hooks/use-analytics"
import { cn } from "@/lib/utils"
import type { DiagnosticReport as DiagnosticReportType } from "@/types"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}

function StrengthBar({ topic, pct }: { topic: string; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{topic}</span>
        <span className="text-green-600 dark:text-green-400 font-semibold">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function WeaknessCard({ topic, pct, suggestion }: { topic: string; pct: number; suggestion: string }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{topic}</span>
        <span className="text-xs font-bold text-destructive">{pct}% error rate</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{suggestion}</p>
    </div>
  )
}

function ReportContent({ report }: { report: DiagnosticReportType }) {
  const strengths = (report.strengths ?? []) as Array<{ topic: string; confidence_pct: number }>
  const weaknesses = (report.weaknesses ?? []) as Array<{ topic: string; error_rate_pct: number; suggestion: string }>

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Narrative */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm leading-relaxed text-foreground">{report.raw_narrative}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              <h3 className="text-sm font-semibold">Core strengths</h3>
            </div>
            <div className="space-y-3">
              {strengths.map((s) => (
                <StrengthBar key={s.topic} topic={s.topic} pct={s.confidence_pct} />
              ))}
            </div>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-destructive" />
              <h3 className="text-sm font-semibold">Areas to focus on</h3>
            </div>
            <div className="space-y-2">
              {weaknesses.map((w) => (
                <WeaknessCard key={w.topic} topic={w.topic} pct={w.error_rate_pct} suggestion={w.suggestion} />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-right text-xs text-muted-foreground">
        Generated {formatDate(report.generated_at)}
      </p>
    </motion.div>
  )
}

export function DiagnosticReport({ hasEnoughData }: { hasEnoughData: boolean }) {
  const { data: diagnosticData, isLoading: reportLoading } = useDiagnostic()
  const { mutate: generate, isPending, error } = useGenerateDiagnostic()

  const report = diagnosticData?.report

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="size-5 text-primary" />
          <h2 className="font-semibold">AI Diagnostic Report</h2>
        </div>
        {report && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={isPending || !hasEnoughData}
            onClick={() => generate()}
          >
            <RefreshCw className={cn("size-3", isPending && "animate-spin")} />
            Regenerate
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      <AnimatePresence mode="wait">
        {reportLoading || isPending ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 py-8 justify-center text-sm text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin text-primary" />
            {isPending ? "Analysing your performance…" : "Loading…"}
          </motion.div>
        ) : report ? (
          <ReportContent key="report" report={report} />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-8 text-center"
          >
            <BrainCircuit className="size-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">No diagnostic yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasEnoughData
                  ? "Generate your first AI diagnostic to see your strengths and what to study next."
                  : "Complete more tests across different topics to unlock your diagnostic report."}
              </p>
            </div>
            {hasEnoughData && (
              <Button size="sm" className="gap-2" disabled={isPending} onClick={() => generate()}>
                <BrainCircuit className="size-4" />
                Generate diagnostic
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
