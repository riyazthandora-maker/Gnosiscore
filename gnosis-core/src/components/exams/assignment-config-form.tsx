"use client"

export interface AssignmentConfig {
  // Timing & Access
  duration_minutes: number
  starts_at: string
  ends_at: string
  max_attempts: number
  // Question Delivery
  randomize_questions: boolean
  shuffle_answers: boolean
  // Navigation
  allow_backtrack: boolean
  mandatory_answering: boolean
  flag_for_review: boolean
  // Security
  browser_lockdown: boolean
  disable_copy_paste: boolean
  tab_switch_warnings: boolean
  tab_switch_limit: number
  // Results
  release_results_immediately: boolean
  show_explanations: boolean
  threshold_excellent: number
  threshold_distinction: number
  threshold_pass: number
}

export const DEFAULT_CONFIG: AssignmentConfig = {
  duration_minutes: 20,
  starts_at: "",
  ends_at: "",
  max_attempts: 3,
  randomize_questions: false,
  shuffle_answers: false,
  allow_backtrack: true,
  mandatory_answering: false,
  flag_for_review: true,
  browser_lockdown: false,
  disable_copy_paste: false,
  tab_switch_warnings: false,
  tab_switch_limit: 3,
  release_results_immediately: true,
  show_explanations: true,
  threshold_excellent: 90,
  threshold_distinction: 80,
  threshold_pass: 70,
}

interface Props {
  config: AssignmentConfig
  onChange: (config: AssignmentConfig) => void
}

function Toggle({ checked, onToggle, label, hint }: { checked: boolean; onToggle: () => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer group">
      <div className="min-w-0">
        <p className="text-sm font-medium group-hover:text-foreground transition-colors">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50 ${checked ? "bg-primary" : "bg-input"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  )
}

function NumberInput({ value, onChange, min, max, label, suffix }: {
  value: number; onChange: (v: number) => void; min: number; max?: number; label: string; suffix?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(Math.max(min, Number(e.target.value)))}
          className="w-20 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-4 divide-y divide-border">{children}</div>
    </div>
  )
}

export function AssignmentConfigForm({ config, onChange }: Props) {
  const set = <K extends keyof AssignmentConfig>(key: K, value: AssignmentConfig[K]) =>
    onChange({ ...config, [key]: value })

  const toggle = (key: keyof AssignmentConfig) =>
    onChange({ ...config, [key]: !config[key] })

  return (
    <div className="flex flex-col gap-4">

      {/* 1. Timing & Access */}
      <Section title="Timing & Access">
        <NumberInput
          label="Exam Duration"
          value={config.duration_minutes}
          onChange={v => set("duration_minutes", v)}
          min={1}
          suffix="min"
        />
        <div className="py-2 flex flex-col gap-2">
          <p className="text-sm font-medium">Availability Window <span className="text-xs text-muted-foreground font-normal">(leave blank for no limit)</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start</label>
              <input
                type="datetime-local"
                value={config.starts_at}
                onChange={e => set("starts_at", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End</label>
              <input
                type="datetime-local"
                value={config.ends_at}
                onChange={e => set("ends_at", e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
              />
            </div>
          </div>
        </div>
        <NumberInput
          label="Attempt Limit"
          value={config.max_attempts}
          onChange={v => set("max_attempts", v)}
          min={1}
          suffix="attempts"
        />
      </Section>

      {/* 2. Question & Answer Delivery */}
      <Section title="Question & Answer Delivery">
        <Toggle
          label="Randomize Question Order"
          hint="Shuffle question sequence per student"
          checked={config.randomize_questions}
          onToggle={() => toggle("randomize_questions")}
        />
        <Toggle
          label="Shuffle Answer Options"
          hint="Randomize A/B/C/D order to prevent answer sharing"
          checked={config.shuffle_answers}
          onToggle={() => toggle("shuffle_answers")}
        />
      </Section>

      {/* 3. Navigation & Control */}
      <Section title="Navigation & Control">
        <Toggle
          label="Allow Backtracking"
          hint="Students can return to previous questions"
          checked={config.allow_backtrack}
          onToggle={() => toggle("allow_backtrack")}
        />
        <Toggle
          label="Mandatory Answering"
          hint="Students must answer before moving to the next question"
          checked={config.mandatory_answering}
          onToggle={() => toggle("mandatory_answering")}
        />
        <Toggle
          label="Flag for Review"
          hint="Students can bookmark unsure questions before submitting"
          checked={config.flag_for_review}
          onToggle={() => toggle("flag_for_review")}
        />
      </Section>

      {/* 4. Security & Anti-Cheating */}
      <Section title="Security & Anti-Cheating">
        <Toggle
          label="Browser Lockdown"
          hint="Force full-screen mode (best-effort; ignored if browser rejects)"
          checked={config.browser_lockdown}
          onToggle={() => toggle("browser_lockdown")}
        />
        <Toggle
          label="Disable Copy / Paste / Print"
          hint="Blocks copy, paste, context menu, and print"
          checked={config.disable_copy_paste}
          onToggle={() => toggle("disable_copy_paste")}
        />
        <Toggle
          label="Tab-Switch Warnings"
          hint="Log or terminate after the threshold is exceeded"
          checked={config.tab_switch_warnings}
          onToggle={() => toggle("tab_switch_warnings")}
        />
        {config.tab_switch_warnings && (
          <NumberInput
            label="Tab-Switch Limit"
            value={config.tab_switch_limit}
            onChange={v => set("tab_switch_limit", v)}
            min={1}
            suffix="switches"
          />
        )}
      </Section>

      {/* 5. Results & Feedback */}
      <Section title="Results & Feedback">
        <Toggle
          label="Release Results Immediately"
          hint="Show final score upon submission"
          checked={config.release_results_immediately}
          onToggle={() => toggle("release_results_immediately")}
        />
        <Toggle
          label="Show Explanations"
          hint="Display rationales post-submission"
          checked={config.show_explanations}
          onToggle={() => toggle("show_explanations")}
        />
        <div className="py-3">
          <p className="text-sm font-medium mb-3">Pass / Fail Thresholds</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["threshold_excellent", "Excellent (%)"],
                ["threshold_distinction", "Distinction (%)"],
                ["threshold_pass", "Pass (%)"],
              ] as [keyof AssignmentConfig, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config[key] as number}
                  onChange={e => set(key, Number(e.target.value))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Below {config.threshold_pass}% = Failed</p>
        </div>
      </Section>

    </div>
  )
}
