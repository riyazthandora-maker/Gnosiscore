import type { Metadata } from "next"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Track your progress and recent activity.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Tests taken", "Avg. score", "Documents"].map((label) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold text-primary">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
