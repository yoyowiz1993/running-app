/**
 * AI provider for generating running training plans.
 * Uses Gemini API (free tier) with structured JSON output.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GoalInput = {
  distanceKm: number
  targetPaceSecPerKm: number
  raceDateISO: string
}

export type AiPlanInput = {
  goal: GoalInput
  startDate: string
  endDate: string
  planName?: string
}

export type AiRawWorkout = {
  dateISO?: string
  title?: string
  type?: string
  plannedDistanceKm?: number
  totalDurationSec?: number
  stages?: Array<{
    label?: string
    kind?: string
    durationSec?: number
    targetPaceSecPerKm?: number
  }>
}

export type AiRawPlan = {
  workouts?: AiRawWorkout[]
}

function paceToReadable(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

const SYSTEM_PROMPT = `You are a professional running coach. Generate a structured training plan as valid JSON only. No markdown, no code blocks, no explanations.

Rules:
- Progressive overload: weekly volume increases gradually, max ~10% per week.
- Recovery week every 4th week: reduce volume ~20%.
- Taper: last 2 weeks before race, reduce volume significantly (week -2: ~70%, week -1: ~50%).
- Weekly distribution: 4 runs/week typical—intervals, tempo, easy, long run.
- Pace ranges: easy = target + 75–95 sec/km, tempo = target + 15–25, intervals = target - 15–30, long = target + 90–110.
- All dates must be between startDate and endDate (inclusive).
- Workout types: exactly one of "easy" | "long" | "tempo" | "intervals" | "race" | "rest".
- Stage kinds: exactly one of "warmup" | "easy" | "tempo" | "interval" | "recovery" | "cooldown" | "race" | "rest".
- Race day: one workout of type "race" on the race date.
- Output ONLY the JSON object, nothing else.`

function buildUserPrompt(input: AiPlanInput): string {
  const pace = paceToReadable(input.goal.targetPaceSecPerKm)
  return `Create a running training plan with these inputs:
- Distance goal: ${input.goal.distanceKm} km (e.g. 10k, half marathon, marathon)
- Target race pace: ${pace} (${input.goal.targetPaceSecPerKm} sec/km)
- Race date: ${input.goal.raceDateISO}
- Plan start date: ${input.startDate}
- Plan end date: ${input.endDate}
${input.planName ? `- Plan name: ${input.planName}` : ''}

Return a JSON object with this exact structure (no other keys, no extra text):
{
  "workouts": [
    {
      "dateISO": "YYYY-MM-DD",
      "title": "string",
      "type": "easy|long|tempo|intervals|race|rest",
      "plannedDistanceKm": number,
      "totalDurationSec": number,
      "stages": [
        {
          "label": "string",
          "kind": "warmup|easy|tempo|interval|recovery|cooldown|race|rest",
          "durationSec": number,
          "targetPaceSecPerKm": number
        }
      ]
    }
  ]
}

Ensure totalDurationSec equals sum of stages' durationSec. Generate the complete plan.`
}

export async function generatePlanFromAI(input: AiPlanInput): Promise<string> {
  const apiKey = process.env.AI_API_KEY?.trim()
  const model = process.env.AI_MODEL || 'gemini-1.5-flash'
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI API error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned no text content')
  }

  return text.trim()
}
