"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"
import { roleHomePath } from "@/types"

type Step = "email" | "otp"

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [usePassword, setUsePassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function redirectByRole(supabase: ReturnType<typeof createClient>) {
    const { data: { user } } = await supabase.auth.getUser()
    const role = (user?.user_metadata?.role ?? "student") as UserRole
    router.push(roleHomePath(role))
    router.refresh()
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      await redirectByRole(supabase)
      return
    }

    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Failed to send login code." }))
      setError(msg ?? "Failed to send login code.")
      return
    }
    setStep("otp")
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "email",
    })
    if (error) {
      setLoading(false)
      setError("Invalid or expired code. Please try again.")
      return
    }
    await redirectByRole(supabase)
    setLoading(false)
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          We sent a 6-digit code to <strong>{email}</strong>. Check your inbox.
        </p>
        <div className="space-y-1">
          <label htmlFor="otp" className="text-sm font-medium">One-time code</label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 tracking-widest text-center text-lg"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verifying…" : "Sign in"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm"
          onClick={() => { setStep("email"); setOtp(""); setError(null) }}
        >
          Use a different email
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      {usePassword && (
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (usePassword ? "Signing in…" : "Sending code…") : (usePassword ? "Sign in" : "Send OTP")}
      </Button>
      <button
        type="button"
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => { setUsePassword(!usePassword); setError(null) }}
      >
        {usePassword ? "Use one-time code instead" : "Sign in with password instead"}
      </button>
    </form>
  )
}
