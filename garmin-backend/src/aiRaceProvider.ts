/**
 * AI provider for searching running races in Israel.
 * Uses the same pattern as aiMealProvider: build prompt, get structured JSON.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type RaceSearchInput = {
  location: string
  radiusKm?: number
  dateFrom?: string
  dateTo?: string
  distances?: string[]
}

export type RaceResult = {
  name: string
  nameHe?: string
  date: string
  city: string
  distances: string[]
  registrationUrl?: string
  latitude?: number
  longitude?: number
}

const SYSTEM_PROMPT = `You are a running race database for Israel. Your job is to list real running races in Israel based on user criteria.

Rules:
- Return ONLY valid JSON — no markdown, no code fences, no commentary.
- Only include REAL races that you know exist. Do not invent races.
- Focus on Israel. Include Hebrew names when you know them.
- If you don't know of any races matching the criteria, return an empty races array.
- Date format: YYYY-MM-DD.
- Distances: use standard names like "5K", "10K", "Half Marathon", "Marathon".`

function buildPrompt(input: RaceSearchInput): string {
  const { location, radiusKm = 50, dateFrom, dateTo, distances } = input
  const loc = location.trim() || 'Israel'

  let datePart = ''
  if (dateFrom && dateTo) {
    datePart = `Races between ${dateFrom} and ${dateTo}.`
  } else if (dateFrom) {
    datePart = `Races from ${dateFrom} onward.`
  } else if (dateTo) {
    datePart = `Races up to ${dateTo}.`
  } else {
    datePart = 'Upcoming races in 2025 and 2026.'
  }

  let distPart = ''
  if (distances && distances.length > 0) {
    distPart = `Prefer these distances: ${distances.join(', ')}.`
  }

  return `List running races in Israel near or in "${loc}" (city or region), within roughly ${radiusKm} km.

${datePart}
${distPart}

Include well-known races such as: Tel Aviv Marathon, Jerusalem Marathon, Dead Sea Marathon, Eilat Marathon, TLV Night Run, Yarkon Half Marathon, Haifa Marathon, Tiberias Marathon, and any others you know in the area.

Return JSON:
{
  "races": [
    {
      "name": "English race name",
      "nameHe": "Hebrew name if known",
      "date": "YYYY-MM-DD",
      "city": "City name",
      "distances": ["5K", "10K", "Half Marathon", "Marathon"],
      "registrationUrl": "https://...",
      "latitude": number or null,
      "longitude": number or null
    }
  ]
}

If no races match, return { "races": [] }.`
}

function parseJsonSafe(raw: string): { races?: unknown[] } | null {
  let text = raw.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) text = text.slice(start, end + 1)
  text = text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (_, s) => s ?? '')
  text = text.replace(/,\s*([\]}])/g, '$1')
  try {
    return JSON.parse(text) as { races?: unknown[] }
  } catch {
    return null
  }
}

export async function searchRaces(input: RaceSearchInput): Promise<RaceResult[]> {
  const apiKey = process.env.AI_API_KEY?.trim()
  const model = process.env.AI_MODEL || 'gemini-3.1-flash-lite-preview'
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
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
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned no text content')
  }

  const parsed = parseJsonSafe(text.trim())
  const races = Array.isArray(parsed?.races) ? parsed.races : []

  return races.map((r) => {
    const rec = r as Record<string, unknown>
    const dist = rec.distances
    const race: RaceResult = {
      name: String(rec.name ?? 'Race'),
      date: String(rec.date ?? '').slice(0, 10),
      city: String(rec.city ?? ''),
      distances: Array.isArray(dist) ? dist.map((d) => String(d)) : [],
    }
    if (rec.nameHe) race.nameHe = String(rec.nameHe)
    if (rec.registrationUrl) race.registrationUrl = String(rec.registrationUrl)
    if (typeof rec.latitude === 'number') race.latitude = rec.latitude
    if (typeof rec.longitude === 'number') race.longitude = rec.longitude
    return race
  })
}
