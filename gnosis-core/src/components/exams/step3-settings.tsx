"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWizard } from "@/components/exams/wizard-context"

// ── Slider ─────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-primary">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <div className="relative flex items-center h-10">
        {/* Track */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native range — invisible but handles all interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full h-2 opacity-0 cursor-pointer touch-none"
          style={{ height: "40px", marginTop: "-19px" }}
        />
        {/* Visible thumb */}
        <div
          className="absolute size-5 rounded-full bg-primary border-2 border-background shadow-md pointer-events-none transition-none"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Step3Settings() {
  const { settings, setSettings, goNext, goBack } = useWizard()

  const { total, easy_pct } = settings
  const easyCount = Math.round(total * easy_pct / 100)
  const hardCount = total - easyCount

  function setTotal(v: number) { setSettings({ ...settings, total: v }) }
  function setEasyPct(v: number) { setSettings({ ...settings, easy_pct: v }) }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Exam Settings</h2>
        <p className="text-sm text-muted-foreground">
          Choose how many questions to generate and the difficulty balance.
        </p>
      </div>

      <div className="flex flex-col gap-8 rounded-xl border border-border p-5">

        {/* Total questions */}
        <Slider
          label="Total Questions"
          value={total}
          min={1}
          max={20}
          onChange={setTotal}
          formatValue={(v) => `${v} question${v === 1 ? "" : "s"}`}
        />

        {/* Difficulty split */}
        <div className="flex flex-col gap-2">
          <Slider
            label="Difficulty Split"
            value={easy_pct}
            min={0}
            max={100}
            onChange={setEasyPct}
            formatValue={(v) => `${v}% Easy`}
          />

          {/* Visual split bar */}
          <div className="relative h-8 rounded-full overflow-hidden flex text-xs font-medium">
            <div
              className={cn(
                "flex items-center justify-center transition-all bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
                easy_pct < 15 && "opacity-0"
              )}
              style={{ width: `${easy_pct}%` }}
            >
              {easy_pct >= 20 && `${easy_pct}%`}
            </div>
            <div
              className={cn(
                "flex items-center justify-center transition-all bg-orange-500/20 text-orange-700 dark:text-orange-400 flex-1",
                easy_pct > 85 && "opacity-0"
              )}
            >
              {easy_pct <= 80 && `${100 - easy_pct}%`}
            </div>
          </div>

          {/* Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Easy</span>
            <span>Hard</span>
          </div>
        </div>

        {/* Summary pill */}
        <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-center gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold">{easyCount}</span>
            <span className="text-muted-foreground">easy</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-orange-500 inline-block" />
            <span className="font-semibold">{hardCount}</span>
            <span className="text-muted-foreground">hard</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold">{total}</span>
            <span className="text-muted-foreground">total</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goBack}>Back</Button>
        <Button onClick={goNext}>Generate Questions</Button>
      </div>
    </div>
  )
}
