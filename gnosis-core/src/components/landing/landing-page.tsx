"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  Clock,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  Languages,
  MessageCircle,
  Upload,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParentReportMockup } from "./parent-report-mockup"
import { copy, WHATSAPP_NUMBER, WHATSAPP_URL, type Locale } from "./landing-copy"

const FEATURE_ICONS = [BrainCircuit, Zap, Clock, BarChart3, FileText]
const BENEFIT_ICONS = [HeartHandshake, Clock, LayoutDashboard]
const STEP_ICONS = [Upload, BookOpen, BarChart3]

// Survives client-side navigation away and back; resets on a full reload.
let sessionLocale: Locale = "en"

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>(() => sessionLocale)
  const c = copy[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = copy[locale].dir
  }, [locale])

  const toggleLocale = () =>
    setLocale((l) => {
      sessionLocale = l === "en" ? "ar" : "en"
      return sessionLocale
    })
  const arrow = c.dir === "rtl" ? "rotate-180" : ""

  return (
    <div dir={c.dir} className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/gnosis-mark.png"
              alt=""
              width={455}
              height={252}
              priority
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
            <span className="text-xl font-bold tracking-tight">GnosisCore</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
            <a href="#features" className="transition-colors hover:text-foreground">{c.nav.features}</a>
            <a href="#parents" className="transition-colors hover:text-foreground">{c.nav.parents}</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">{c.nav.pricing}</a>
            <a href="#faq" className="transition-colors hover:text-foreground">{c.nav.faq}</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={toggleLocale}>
              <Languages className="size-4" />
              <span className="hidden sm:inline">{c.langLabel}</span>
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">{c.nav.signIn}</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">{c.nav.getStarted}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center">
        {/* Hero */}
        <section className="flex w-full flex-col items-center px-6 py-20 text-center sm:py-24">
          <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            {c.hero.badge}
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            {c.hero.titleBefore} <span className="text-primary">{c.hero.titleHighlight}</span>{" "}
            {c.hero.titleAfter}
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">{c.hero.subtitle}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-6">
                {c.hero.ctaPrimary} <ArrowRight className={`size-4 ${arrow}`} />
              </Button>
            </Link>
            <a href="#parents">
              <Button variant="outline" size="lg" className="px-6">{c.hero.ctaParent}</Button>
            </a>
          </div>
        </section>

        {/* Curriculum trust bar */}
        <section className="w-full border-y border-border/50 bg-muted/30 px-6 py-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {c.curricula.label}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {c.curricula.items.map((item) => (
                <span key={item} className="text-sm font-semibold text-foreground/70">{item}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="w-full max-w-6xl scroll-mt-20 px-6 py-20">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{c.features.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.items.map(({ title, desc }, i) => {
              const Icon = FEATURE_ICONS[i]
              return (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="w-full border-y border-border/50 bg-muted/30 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">{c.how.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">{c.how.subtitle}</p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {c.how.steps.map((step, i) => {
                const Icon = STEP_ICONS[i]
                return (
                  <div key={step.title} className="flex flex-col items-center text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </div>
                    <span className="mb-2 text-xs font-semibold text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mb-2 font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Parents */}
        <section id="parents" className="w-full max-w-6xl scroll-mt-20 px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                {c.parents.badge}
              </span>
              <h2 className="mt-4 text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {c.parents.title}
              </h2>
              <p className="mt-4 text-muted-foreground">{c.parents.subtitle}</p>

              <div className="mt-8 space-y-6">
                {c.parents.benefits.map((b, i) => {
                  const Icon = BENEFIT_ICONS[i]
                  return (
                    <div key={b.title} className="flex gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="size-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{b.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-primary">{c.parents.priceAmount}</span>
                  <span className="text-sm font-medium text-muted-foreground">{c.parents.pricePeriod}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.parents.priceAnchor}</p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link href="/register">
                  <Button size="lg" className="px-6">{c.parents.cta}</Button>
                </Link>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="size-4" />
                  {c.parents.whatsapp}
                </a>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {c.parents.whatsappNote} · {WHATSAPP_NUMBER}
              </p>
            </div>

            <ParentReportMockup m={c.parents.mockup} />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="w-full border-y border-border/50 bg-muted/30 px-6 py-20">
          <div className="mx-auto max-w-4xl scroll-mt-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">{c.pricing.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">{c.pricing.subtitle}</p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {c.pricing.plans.map((plan) => (
                <div
                  key={plan.name}
                  className={
                    plan.highlight
                      ? "relative rounded-2xl border-2 border-primary bg-card p-6 shadow-sm"
                      : "rounded-2xl border border-border bg-card p-6"
                  }
                >
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold">{plan.amount}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className="mt-6 block">
                    <Button variant={plan.highlight ? "default" : "outline"} className="w-full">
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full max-w-3xl scroll-mt-20 px-6 py-20">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{c.faq.title}</h2>
          <div className="space-y-3">
            {c.faq.items.map((item) => (
              <details key={item.q} className="group rounded-xl border border-border bg-card p-5">
                <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <Image
            src="/gnosis-logo.png"
            alt="GnosisCore"
            width={657}
            height={377}
            className="h-16 w-auto dark:brightness-0 dark:invert"
          />
          <p className="max-w-md text-sm text-muted-foreground">{c.footer.tagline}</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MessageCircle className="size-4" />
            {c.footer.contact} · {WHATSAPP_NUMBER}
          </a>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GnosisCore · Built for learners.
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={c.parents.whatsapp}
        className="fixed bottom-5 end-5 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="size-6" />
      </a>
    </div>
  )
}
