"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { STORAGE_LIMITS } from "@/types"
import { cn } from "@/lib/utils"

async function fetchProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("users")
    .select("tier, storage_used_bytes")
    .eq("id", user.id)
    .single()
  return data
}

export function StorageUsage() {
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile })

  if (!profile) return null

  const limits = STORAGE_LIMITS[profile.tier as keyof typeof STORAGE_LIMITS]
  const pct = Math.min((profile.storage_used_bytes / limits.total) * 100, 100)
  const usedMB = (profile.storage_used_bytes / 1024 / 1024).toFixed(1)
  const totalMB = limits.total / 1024 / 1024

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">Storage</span>
        <span className="text-muted-foreground">{usedMB} / {totalMB} MB</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {profile.tier === "basic" && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium capitalize">{profile.tier}</span> plan ·{" "}
          <a href="/settings" className="text-primary hover:underline">Upgrade to Pro</a> for 100 MB
        </p>
      )}
    </div>
  )
}
