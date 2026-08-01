"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Settings, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlatformSettings {
  file_size_limit_bytes: number
  question_approval_threshold: number
  max_pause_duration_seconds: number
  max_storage_bytes: number
  max_docs_per_chapter: number
  monthly_upload_limit: number
  updated_at: string
}

function SettingRow({
  label,
  description,
  value,
  onChange,
  min,
  step,
  unit,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  min: number
  step?: number
  unit: string
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min={min}
          step={step ?? 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 text-right"
        />
        <span className="text-xs text-muted-foreground w-12">{unit}</span>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const qc = useQueryClient()
  const [fileSizeMB, setFileSizeMB] = useState("")
  const [threshold, setThreshold] = useState("")
  const [pauseMin, setPauseMin] = useState("")
  const [storageMB, setStorageMB] = useState("")
  const [maxDocs, setMaxDocs] = useState("")
  const [monthlyUploads, setMonthlyUploads] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: settingsData, isLoading, isError } = useQuery<{ settings: PlatformSettings }>({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const r = await fetch("/api/admin/settings")
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    },
  })

  useEffect(() => {
    if (settingsData && !loaded) {
      setFileSizeMB(String(settingsData.settings.file_size_limit_bytes / 1024 / 1024))
      setThreshold(String(settingsData.settings.question_approval_threshold))
      setPauseMin(String(Math.round(settingsData.settings.max_pause_duration_seconds / 60)))
      setStorageMB(String(settingsData.settings.max_storage_bytes / 1024 / 1024))
      setMaxDocs(String(settingsData.settings.max_docs_per_chapter))
      setMonthlyUploads(String(settingsData.settings.monthly_upload_limit))
      setLoaded(true)
    }
  }, [settingsData, loaded])

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_size_limit_bytes: Math.round(parseFloat(fileSizeMB) * 1024 * 1024),
          question_approval_threshold: parseInt(threshold, 10),
          max_pause_duration_seconds: parseInt(pauseMin, 10) * 60,
          max_storage_bytes: Math.round(parseFloat(storageMB) * 1024 * 1024),
          max_docs_per_chapter: parseInt(maxDocs, 10),
          monthly_upload_limit: parseInt(monthlyUploads, 10),
        }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-settings"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-16 justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 py-10 text-center">
        <p className="text-sm text-destructive font-medium">Failed to load settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground text-sm">Global limits applied across all teachers.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-6 py-2">
        <SettingRow
          label="Max file size"
          description="Maximum size allowed per uploaded document."
          value={fileSizeMB}
          onChange={setFileSizeMB}
          min={1}
          step={1}
          unit="MB"
        />
        <SettingRow
          label="Question approval threshold"
          description="Requests above this count require admin approval before generating."
          value={threshold}
          onChange={setThreshold}
          min={1}
          unit="questions"
        />
        <SettingRow
          label="Max pause duration"
          description="Maximum time a student can pause an exam before auto-submit."
          value={pauseMin}
          onChange={setPauseMin}
          min={1}
          unit="minutes"
        />
        <SettingRow
          label="Total storage per teacher"
          description="Maximum cumulative storage for chapter documents per educator."
          value={storageMB}
          onChange={setStorageMB}
          min={1}
          step={10}
          unit="MB"
        />
        <SettingRow
          label="Max docs per chapter"
          description="Maximum number of documents allowed in a single chapter."
          value={maxDocs}
          onChange={setMaxDocs}
          min={1}
          unit="docs"
        />
        <SettingRow
          label="Monthly upload limit"
          description="Maximum number of document uploads per educator per calendar month."
          value={monthlyUploads}
          onChange={setMonthlyUploads}
          min={1}
          unit="uploads"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => save()} disabled={isPending} className="gap-2">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save settings
        </Button>
        {saved && <p className="text-sm text-green-600 dark:text-green-400 font-medium">Settings saved.</p>}
      </div>
    </div>
  )
}
