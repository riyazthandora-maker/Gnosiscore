import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, BrainCircuit, BarChart3, Clock, FileText, Zap } from "lucide-react"

const features = [
  {
    icon: BrainCircuit,
    title: "AI-Generated Questions",
    desc: "Upload any PDF or image and get an infinite stream of practice questions tailored to your material.",
  },
  {
    icon: Zap,
    title: "Adaptive Difficulty",
    desc: "Choose Easy, Medium, Hard, or Advanced. The AI matches the depth of your chosen level precisely.",
  },
  {
    icon: Clock,
    title: "Timed Practice",
    desc: "Set per-question timers and total test limits to simulate real exam pressure.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    desc: "Get AI diagnostic reports identifying your exact strengths and conceptual gaps.",
  },
  {
    icon: FileText,
    title: "Shareable Tests",
    desc: "Invite anyone via Gmail to take a test you configured. Collaborate and compete.",
  },
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-primary">GnosisCore</span>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get started free</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center">
        <section className="flex w-full flex-col items-center px-6 py-24 text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            AI-powered · Unlimited practice · Free to start
          </div>
          <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight leading-tight sm:text-6xl">
            Never run out of{" "}
            <span className="text-primary">practice questions</span>{" "}
            again
          </h1>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Upload your study material. Configure your test. Let AI generate an endless stream of
            perfectly calibrated questions to build real mastery.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-6">
                Start for free <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-6">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="w-full max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
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
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} GnosisCore · Built for learners.
      </footer>
    </div>
  )
}
