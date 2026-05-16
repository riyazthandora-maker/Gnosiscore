import type { Metadata } from "next"
import { Suspense } from "react"
import { SharePanel } from "@/components/sharing/share-panel"
import { BillingPanel } from "@/components/settings/billing-panel"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your plan, access, and preferences.</p>
      </div>
      <div className="grid gap-6 max-w-2xl lg:grid-cols-[1fr_1fr]">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
            <BillingPanel />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <SharePanel />
        </div>
      </div>
    </div>
  )
}
