import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, whatsapp, role, created_at")
    .eq("id", user!.id)
    .single()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your account details.</p>
      </div>
      <div className="max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</p>
          <p className="mt-1 font-medium">{profile?.full_name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</p>
          <p className="mt-1 font-medium">{profile?.email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</p>
          <p className="mt-1 font-medium">{profile?.whatsapp || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</p>
          <p className="mt-1 font-medium capitalize">
            {profile?.role === "educator_parent" ? "Educator / Parent" : profile?.role}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member since</p>
          <p className="mt-1 font-medium">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>
    </div>
  )
}
