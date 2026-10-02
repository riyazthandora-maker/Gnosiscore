import type { Metadata } from "next"
import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "GnosisCore — AI practice, diagnostics and weekly parent reports",
  description:
    "AI-generated practice from your child's own school material. Weekly diagnostics for IGCSE, IB, CBSE and American curriculum students in the UAE and Middle East.",
}

export default function HomePage() {
  return <LandingPage />
}
