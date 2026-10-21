"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"
import { roleHomePath } from "@/types"

type Step = "form" | "verify" | "walkin" | "higher_ed"

const GRADE_OPTIONS = [
  { value: "Grade 1",  label: "Grade 1" },
  { value: "Grade 2",  label: "Grade 2" },
  { value: "Grade 3",  label: "Grade 3" },
  { value: "Grade 4",  label: "Grade 4" },
  { value: "Grade 5",  label: "Grade 5" },
  { value: "Grade 6",  label: "Grade 6" },
  { value: "Grade 7",  label: "Grade 7" },
  { value: "Grade 8",  label: "Grade 8" },
  { value: "Grade 9",  label: "Grade 9" },
  { value: "Grade 10", label: "Grade 10" },
  { value: "Grade 11", label: "Grade 11" },
  { value: "Grade 12", label: "Grade 12" },
  { value: "Degree",       label: "Degree" },
  { value: "Master",       label: "Master" },
  { value: "Professional", label: "Professional" },
]

interface FormData {
  full_name: string
  email: string
  password: string
  confirm_password: string
  role: UserRole
  contact: string
  grade: string
  subjects: string
}

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>("form")
  const [form, setForm] = useState<FormData>({
    full_name: "",
    email: searchParams.get("email") ?? "",
    password: "",
    confirm_password: "",
    role: (searchParams.get("role") as UserRole | null) ?? "student",
    contact: "",
    grade: "",
    subjects: "",
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
        contact: form.contact,
        grade: form.grade,
        subjects: form.subjects,
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
    // A student with no educator linked to their email waits on the hold screen
    // instead of landing on an empty student area nobody has been assigned to.
    if (regData.walkin) {
      setLoading(false)
      setStep(regData.higherEd ? "higher_ed" : "walkin")
      return
    }
    if (regData.held || role === "educator_parent") {
      router.push("/pending-approval")
    } else {
      router.push(roleHomePath(role))
    }
    router.refresh()
  }

  if (step === "walkin") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <svg className="size-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          You have an email for a quick 5-minute assessment. Complete it to discover your strengths — it only takes a few minutes!
        </p>
        <p className="text-xs text-muted-foreground">
          Sent to <strong>{form.email}</strong>
        </p>
      </div>
    )
  }

  if (step === "higher_ed") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10">
          <svg className="size-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">We&apos;ll be in touch</h2>
        <p className="text-sm text-muted-foreground">
          Our admin will contact you shortly to discuss how we can support your learning journey.
        </p>
        <p className="text-xs text-muted-foreground">
          Account created for <strong>{form.email}</strong>
        </p>
      </div>
    )
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

      {form.role === "student" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="grade" className="text-sm font-medium">Grade / year</label>
            <select
              id="grade"
              required
              value={form.grade}
              onChange={(e) => update("grade", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="" disabled>Select grade…</option>
              {GRADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="subjects" className="text-sm font-medium">Subjects you want support with</label>
            <input
              id="subjects"
              type="text"
              required
              value={form.subjects}
              onChange={(e) => update("subjects", e.target.value)}
              placeholder="e.g. Maths, Physics, Chemistry"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="contact" className="text-sm font-medium">
              Contact number <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="contact"
              type="tel"
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="+971 50 123 4567"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This helps us match you with the right teacher. If you have an invite link from your school, open it to join straight away.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading
          ? (form.role === "educator_parent" ? "Sending code…" : "Creating account…")
          : (form.role === "educator_parent" ? "Send verification code" : "Create account")}
      </Button>
    </form>
  )
}
