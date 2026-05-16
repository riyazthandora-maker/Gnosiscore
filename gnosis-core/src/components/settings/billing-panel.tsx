"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Loader2, Sparkles, CreditCard, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Tier } from "@/types"
import { STORAGE_LIMITS } from "@/types"

const FEATURES = {
  basic: [
    "2 MB per upload",
    "20 MB total storage",
    "Unlimited test generation",
    "Full analytics & diagnostics",
  ],
  pro: [
    "10 MB per upload",
    "100 MB total storage",
    "Everything in Basic",
    "Priority support",
  ],
}

export function BillingPanel() {
  const searchParams = useSearchParams()
  const [tier, setTier] = useState<Tier | null>(null)
  const [loading, setLoading] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from("users").select("tier").eq("id", user.id).single()
        .then(({ data }) => setTier(data?.tier ?? "basic"))
    })
    if (searchParams.get("upgraded") === "1") setUpgradeSuccess(true)
  }, [searchParams])

  async function handleUpgrade() {
    setLoading(true)
    const res = await fetch("/api/billing/checkout", { method: "POST" })
    if (!res.ok) { setLoading(false); return }
    const { url } = await res.json()
    window.location.href = url
  }

  async function handlePortal() {
    setLoading(true)
    const res = await fetch("/api/billing/portal", { method: "POST" })
    if (!res.ok) { setLoading(false); return }
    const { url } = await res.json()
    window.location.href = url
  }

  const isPro = tier === "pro"
  const limits = tier ? STORAGE_LIMITS[tier] : null

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-primary" />
        <h2 className="font-semibold">Plan & billing</h2>
      </div>

      <AnimatePresence>
        {upgradeSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            You're now on the Pro plan. Welcome!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current plan */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
          isPro ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {isPro && <Sparkles className="size-3.5" />}
          {tier ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan` : "Loading…"}
        </div>
        {limits && (
          <span className="text-sm text-muted-foreground">
            {limits.perUpload / 1024 / 1024} MB per upload · {limits.total / 1024 / 1024} MB storage
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["basic", "pro"] as Tier[]).map((plan) => {
          const active = tier === plan
          return (
            <div
              key={plan}
              className={cn(
                "rounded-xl border p-4 space-y-3 transition-colors",
                active ? "border-primary/40 bg-primary/5" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold capitalize">{plan}</p>
                {plan === "pro" && <span className="text-xs font-bold text-primary">Paid</span>}
                {plan === "basic" && <span className="text-xs text-muted-foreground">Free</span>}
              </div>
              <ul className="space-y-1.5">
                {FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {active && (
                <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Current plan
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* CTA */}
      {!isPro ? (
        <Button className="w-full gap-2" onClick={handleUpgrade} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          Upgrade to Pro
        </Button>
      ) : (
        <Button variant="outline" className="w-full" onClick={handlePortal} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Manage subscription"}
        </Button>
      )}
    </section>
  )
}
