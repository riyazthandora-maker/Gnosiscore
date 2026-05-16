"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface InvitationEntry {
  id: string
  invitee_email: string
  status: string
  expires_at: string
  created_at: string
  token: string
  test_configs: {
    name: string | null
    toughness: string
    total_questions: number
    documents: { title: string } | null
  } | null
}

async function fetchInvitations(): Promise<{ invitations: InvitationEntry[] }> {
  const res = await fetch("/api/invitations")
  if (!res.ok) throw new Error("Failed to load invitations")
  return res.json()
}

export function useInvitations() {
  return useQuery({ queryKey: ["invitations"], queryFn: fetchInvitations })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { config_id: string; invitee_email: string }) => {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      })
      if (!res.ok) { const { error } = await res.json(); throw new Error(error) }
      return res.json() as Promise<{ invitation: InvitationEntry; inviteUrl: string }>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/invitations/${id}`, { method: "DELETE" })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  })
}
