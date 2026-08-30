"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import type { ExamQuestion } from "@/types"
import type { FlatBlock } from "@/types/book"

export interface BookForExam {
  id: string
  title: string
  blocks: FlatBlock[]
}

interface WizardContextValue {
  step: number
  goNext: () => void
  goBack: () => void

  books: BookForExam[]
  setBooks: (books: BookForExam[]) => void

  selectedNodeIds: Set<string>
  setSelectedNodeIds: (ids: Set<string>) => void

  weightages: Record<string, number>
  setWeightages: (w: Record<string, number>) => void

  settings: { total: number; easy_pct: number }
  setSettings: (s: { total: number; easy_pct: number }) => void

  questions: ExamQuestion[]
  setQuestions: (q: ExamQuestion[]) => void

  title: string
  setTitle: (t: string) => void

  generalInstruction: string
  setGeneralInstruction: (s: string) => void
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1)
  const [books, setBooks] = useState<BookForExam[]>([])
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [weightages, setWeightages] = useState<Record<string, number>>({})
  const [settings, setSettings] = useState({ total: 10, easy_pct: 90 })
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [title, setTitle] = useState("")
  const [generalInstruction, setGeneralInstruction] = useState("")

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 6)), [])
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), [])

  return (
    <WizardContext.Provider value={{
      step, goNext, goBack,
      books, setBooks,
      selectedNodeIds, setSelectedNodeIds,
      weightages, setWeightages,
      settings, setSettings,
      questions, setQuestions,
      title, setTitle,
      generalInstruction, setGeneralInstruction,
    }}>
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error("useWizard must be used within WizardProvider")
  return ctx
}
