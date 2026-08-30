"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { WizardProvider, useWizard } from "@/components/exams/wizard-context"
import { Step1ContentPicker } from "@/components/exams/step1-content-picker"
import { Step2Weightage } from "@/components/exams/step2-weightage"
import { Step3Settings } from "@/components/exams/step3-settings"
import { Step4Editor } from "@/components/exams/step4-editor"
import { Step5Preview } from "@/components/exams/step5-preview"

const STEPS = [
  { label: "Content" },
  { label: "Weightage" },
  { label: "Settings" },
  { label: "Review" },
  { label: "Preview" },
  { label: "Save" },
]

function StepIndicator() {
  const { step } = useWizard()
  return (
    <>
      {/* Mobile: label + progress bar */}
      <div className="md:hidden">
        <p className="text-sm text-muted-foreground mb-2">
          Step {step} of {STEPS.length} — <span className="font-medium text-foreground">{STEPS[step - 1].label}</span>
        </p>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: numbered pills */}
      <div className="hidden md:flex items-start">
        {STEPS.map(({ label }, i) => {
          const n = i + 1
          const isActive = n === step
          const isDone = n < step
          return (
            <div key={n} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  isActive  ? "border-primary bg-primary text-primary-foreground"
                  : isDone  ? "border-primary bg-primary/10 text-primary"
                  :           "border-border bg-background text-muted-foreground"
                )}>
                  {isDone ? "✓" : n}
                </div>
                <span className={cn(
                  "text-xs whitespace-nowrap",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-px mx-2 mt-4 transition-colors",
                  isDone ? "bg-primary" : "bg-border"
                )} />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function StepPlaceholder({ name }: { name: string }) {
  const { step, goBack } = useWizard()
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center rounded-xl border border-dashed border-border">
      <p className="font-medium">Step {step}: {name}</p>
      <p className="text-sm text-muted-foreground">Coming in a later phase.</p>
      <Button variant="outline" size="sm" onClick={goBack}>Back</Button>
    </div>
  )
}

function WizardShell() {
  const { step } = useWizard()
  return (
    <div className={cn(
      "flex flex-col gap-6 p-4 md:p-6 pb-24 md:pb-6 mx-auto w-full transition-all",
      step === 5 ? "max-w-4xl" : "max-w-3xl"
    )}>
      <div>
        <h1 className="text-xl font-semibold mb-4">New Exam</h1>
        <StepIndicator />
      </div>

      <div>
        {step === 1 && <Step1ContentPicker />}
        {step === 2 && <Step2Weightage />}
        {step === 3 && <Step3Settings />}
        {step === 4 && <Step4Editor />}
        {step === 5 && <Step5Preview />}
        {step === 6 && <StepPlaceholder name="Name & Save" />}
      </div>
    </div>
  )
}

export function ExamWizard() {
  return (
    <WizardProvider>
      <WizardShell />
    </WizardProvider>
  )
}
