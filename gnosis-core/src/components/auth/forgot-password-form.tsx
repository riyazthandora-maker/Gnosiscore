"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Step = "email" | "otp" | "reset" | "done"

export function ForgotPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch("/api/auth/password-reset/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Failed to send code." }))
      setError(msg ?? "Failed to send reset code.")
      return
    }
    setStep("otp")
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "recovery",
    })
    setLoading(false)
    if (verifyErr) {
      setError("Invalid or expired code. Please try again.")
      return
    }
    setStep("reset")
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }
    setLoading(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setLoading(false)
      setError(updateErr.message)
      return
    }
    await supabase.auth.signOut()
    setLoading(false)
    setStep("done")
  }

  if (step === "done") {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">Password updated successfully!</p>
          <p className="mt-1 text-xs text-muted-foreground">You can now sign in with your new password.</p>
        </div>
        <Button className="w-full" onClick={() => router.push("/login")}>Sign in</Button>
      </div>
    )
  }

  if (step === "reset") {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Choose a new password for <strong>{email}</strong>.
        </p>
        <div className="space-y-1">
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Confirm password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Set new password"}
        </Button>
      </form>
    )
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          We sent a 6-digit code to <strong>{email}</strong>. Check your inbox.
        </p>
        <div className="space-y-1">
          <label htmlFor="otp" className="text-sm font-medium">Reset code</label>
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
          {loading ? "Verifying…" : "Verify code"}
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
    <form onSubmit={handleSend} className="space-y-4">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send reset code"}
      </Button>
    </form>
  )
}
