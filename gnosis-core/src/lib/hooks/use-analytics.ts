"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AnalyticsPayload } from "@/app/api/analytics/route"
import type { DiagnosticReport } from "@/types"

async function fetchAnalytics(): Promise<AnalyticsPayload> {
  const res = await fetch("/api/analytics")
  if (!res.ok) throw new Error("Failed to load analytics")
  return res.json()
}

async function fetchDiagnostic(): Promise<{ report: DiagnosticReport | null }> {
  const res = await fetch("/api/analytics/diagnose")
  if (!res.ok) throw new Error("Failed to load diagnostic")
  return res.json()
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics, staleTime: 30_000 })
}

export function useDiagnostic() {
  return useQuery({ queryKey: ["diagnostic"], queryFn: fetchDiagnostic })
}

export function useGenerateDiagnostic() {
  const queryClient = useQueryClient()
  const analytics = queryClient.getQueryData<AnalyticsPayload>(["analytics"])

  return useMutation({
    mutationFn: async () => {
      if (!analytics) throw new Error("Analytics data not loaded")
      const res = await fetch("/api/analytics/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overview: analytics.overview, topics: analytics.topics }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["diagnostic"] }),
  })
}
