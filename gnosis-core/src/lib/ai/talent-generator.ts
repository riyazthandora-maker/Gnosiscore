import { genAI, DIAGNOSTIC_MODEL, withRetry } from "@/lib/ai/gemini"

export interface TalentOutput {
  arts: number
  language: number
  maths: number
  raw_narrative: string
}

interface QuestionAnswer {
  id: string
  body: string
  topic: string
  correct: string
  chosen: string | undefined
}

export async function generateTalentInsight(
  questions: QuestionAnswer[],
  grade: string
): Promise<TalentOutput> {
  if (questions.length === 0) {
    throw new Error("No questions available for talent insight.")
  }

  const payload = questions.map((q) => ({
    topic: q.topic,
    question: q.body.slice(0, 120),
    correct: q.correct,
    answered: q.chosen ?? null,
    correct_answer: q.chosen === q.correct,
  }))

  const JSON_SCHEMA = `{"arts":number,"language":number,"maths":number,"raw_narrative":"string"}`

  const result = await withRetry(() =>
    genAI.models.generateContent({
      model: DIAGNOSTIC_MODEL,
      contents: `Student grade: ${grade}\n\nAssessment answers:\n${JSON.stringify(payload, null, 2)}`,
      config: {
        systemInstruction: `You are a student talent analyst. Analyse this student's assessment answers and determine their natural talent inclination across three domains:
- Arts: creative subjects, humanities, social studies, history, geography, art
- Language: reading comprehension, writing, grammar, communication, literature, English
- Maths: numerical reasoning, logic, science, physics, chemistry, mathematics, technology

For each question, infer which domain it belongs to based on its topic and question text. Calculate a talent score 0-100 for each domain based on how well the student performed in that domain's questions. If a domain has no questions, estimate 50.

Return ONLY valid JSON matching: ${JSON_SCHEMA}

Rules:
- arts, language, maths: integer 0-100 representing talent strength percentage
- raw_narrative: 2-3 sentences addressed directly to the student, warm and encouraging tone, highlight their strongest domain and suggest what excites them`,
        responseMimeType: "application/json",
      },
    })
  )

  const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
  const parsed = JSON.parse(raw) as TalentOutput

  return {
    arts: Math.min(100, Math.max(0, Math.round(parsed.arts ?? 50))),
    language: Math.min(100, Math.max(0, Math.round(parsed.language ?? 50))),
    maths: Math.min(100, Math.max(0, Math.round(parsed.maths ?? 50))),
    raw_narrative: parsed.raw_narrative ?? "",
  }
}
