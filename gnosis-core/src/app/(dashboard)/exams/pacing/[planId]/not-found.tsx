import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <p className="text-sm text-muted-foreground">Plan not found.</p>
      <Link href="/exams/pacing" className="text-xs text-primary hover:underline">Back to Pacing Plans</Link>
    </div>
  )
}
