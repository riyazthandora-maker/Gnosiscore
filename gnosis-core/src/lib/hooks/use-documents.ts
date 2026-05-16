"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Document } from "@/types"

async function fetchDocuments(): Promise<Document[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export function useDocuments() {
  const { data: documents = [], ...rest } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
    // poll while any document is still processing
    refetchInterval: (query) => {
      const docs = query.state.data as Document[] | undefined
      return docs?.some((d) => d.status === "processing") ? 3000 : false
    },
  })
  return { documents, ...rest }
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })
}
