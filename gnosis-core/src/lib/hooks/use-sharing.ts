"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface ShareEntry {
  id: string
  granted_at: string
  viewer?: { id: string; email: string; display_name: string | null; avatar_url: string | null }
  owner?: { id: string; email: string; display_name: string | null; avatar_url: string | null }
}

async function fetchSharing(): Promise<{ granted: ShareEntry[]; received: ShareEntry[] }> {
  const res = await fetch("/api/sharing")
  if (!res.ok) throw new Error("Failed to load sharing settings")
  return res.json()
}

export function useSharing() {
  return useQuery({ queryKey: ["sharing"], queryFn: fetchSharing })
}

export function useGrantShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sharing"] }),
  })
}

export function useRevokeShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sharing/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to revoke")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sharing"] }),
  })
}
