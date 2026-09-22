import { createAdminClient } from "@/lib/supabase/admin"

interface NotifyOptions {
  userId: string
  type: string
  payload: Record<string, unknown>
}

export async function notify({ userId, type, payload }: NotifyOptions): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from("notifications")
    .insert({ user_id: userId, type, payload })
  if (error) console.error(`[notify] failed for type=${type} user=${userId}:`, error.message)
}
