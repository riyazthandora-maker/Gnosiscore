"use client"

import { BookOpen, CheckCircle2, Clock, Target, TrendingUp, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import type { OverviewStats } from "@/app/api/analytics/route"

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const STATS = (o: OverviewStats) => [
  { label: "Tests taken", value: o.testsTaken, icon: BookOpen, color: "text-primary" },
  { label: "Avg. score", value: `${Math.round(o.avgScore)}%`, icon: TrendingUp, color: "text-blue-500" },
  { label: "Best score", value: `${Math.round(o.bestScore)}%`, icon: Trophy, color: "text-amber-500" },
  { label: "Accuracy", value: `${Math.round(o.accuracyPct)}%`, icon: Target, color: "text-green-500" },
  { label: "Questions done", value: o.totalAnswered.toLocaleString(), icon: CheckCircle2, color: "text-purple-500" },
  { label: "Study time", value: formatTime(o.totalTimeSecs), icon: Clock, color: "text-rose-500" },
]

export function OverviewStats({ data }: { data: OverviewStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STATS(data).map(({ label, value, icon: Icon, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-current/10 ${color}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function OverviewStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}
