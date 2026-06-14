"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"
import { roleHomePath } from "@/types"

type Step = "form" | "verify"

interface FormData {
  full_name: string
  email: string
  password: string
  confirm_password: string
  role: UserRole
}

export function RegisterForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("form")
  const [form, setForm] = useState<FormData>({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "student",
  })
  const [otp, setOtp] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    // Educator/parent must verify email before account creation
    if (form.role === "educator_parent") {
      const res = await fetch("/api/auth/otp/send-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) {
        setError(data.error ?? "Failed to send verification code.")
        return
      }
      setOtpToken(data.token)
      setStep("verify")
      return
    }

    await createAccount()
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!otp.trim()) { setError("Enter the verification code."); return }
    setLoading(true)
    await createAccount(otp.trim(), otpToken)
  }

  async function createAccount(otpCode?: string, otpVerifyToken?: string) {
    const regRes = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        ...(otpCode ? { otpCode, otpToken: otpVerifyToken } : {}),
      }),
    })
    const regData = await regRes.json()
    if (!regRes.ok) {
      setLoading(false)
      setError(regData.error ?? "Failed to create account. Please try again.")
      return
    }

    const supabase = createClient()
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    setLoading(false)
    if (signInErr) {
      setError(signInErr.message)
      return
    }

    const role = (signInData.user?.user_metadata?.role ?? "student") as UserRole
    if (role === "educator_parent") {
      router.push("/pending-approval")
    } else {
      router.push(roleHomePath(role))
    }
    router.refresh()
  }

  // OTP verification step (educator_parent only)
  if (step === "verify") {
    return (
      <form onSubmit={handleVerifySubmit} className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-center">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">
            We sent a 6-digit code to <strong>{form.email}</strong>.
            Enter it below to verify your email and create your account.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="otp" className="text-sm font-medium">Verification code</label>
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
          {loading ? "Creating account…" : "Verify & create account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm"
          onClick={() => { setStep("form"); setOtp(""); setError(null) }}
        >
          Go back
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="full_name" className="text-sm font-medium">Full name</label>
        <input
          id="full_name"
          type="text"
          required
          value={form.full_name}
          onChange={(e) => update("full_name", e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="Min. 8 characters"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirm_password" className="text-sm font-medium">Confirm password</label>
        <input
          id="confirm_password"
          type="password"
          required
          minLength={8}
          value={form.confirm_password}
          onChange={(e) => update("confirm_password", e.target.value)}
          placeholder="Repeat password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">I am a…</p>
        <div className="grid grid-cols-2 gap-2">
          {(["student", "educator_parent"] as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => update("role", r)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.role === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:border-ring"
              }`}
            >
              {r === "student" ? "Student" : "Teacher / Parent"}
            </button>
          ))}
        </div>
        {form.role === "educator_parent" && (
          <p className="text-xs text-muted-foreground">
            You&apos;ll receive a verification code at your email before your account is created.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? (form.role === "educator_parent" ? "Sending code…" : "Creating account…")
          : (form.role === "educator_parent" ? "Send verification code" : "Create account")}
      </Button>
    </form>
  )
}
