/**
 * AI provider for searching running races in Israel.
 * Uses professional system prompt + JSON schema for structured output (Gemini 3.1 Flash).
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type RaceSearchInput = {
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
  surfaceType?: string
  description?: string
  latitude?: number
  longitude?: number
}

const SYSTEM_PROMPT = `You are an expert sports event coordinator specializing in Israeli athletics and marathon logistics. Your task is to provide a comprehensive, up-to-date list of running races in Israel.

**Objective:** For a given set of distances (e.g., 5K, 10K, 21.1K, 42.2K) and date range, find and return EVERY professional race in Israel scheduled in that period that includes those categories. Be comprehensive — return 10–20+ races when the date range spans multiple months, not just 3–5.

**Known 2026 dates (use these — do not guess):**
- Jerusalem Marathon: 2026-03-27 (NOT March 13 or 20)
- Be'er Sheva LightRun (IKEA Night Run): 2026-04-29
- Herzliya Race (Mirotz Herzliya): 2026-05-02
- Kfar Saba Race: 2026-05-09
- Petah Tikva Night Run: 2026-06-04
- Yarkon Park Night Run (Tel Aviv): 2026-10-09
- Tel Aviv Night Run (TLV Night Run): 2026-10-29
- Sovev Emek (Trail Run): 2026-11-05
- Winner Nesher Race (Israel 10K Championship): 2026-11-06
- Mirotz Haifa: 2026-11-20
- Eilat Desert Marathon: 2026-11-27
- Winner Emek HaMa'ayanot: 2026-12-04 or 2026-12-11 (mid-December)
- Beit She'an Valley Marathon: 2026-12-04

**Races to include (when in date range):** Jerusalem Marathon, Tel Aviv Marathon, Dead Sea Marathon, Eilat Marathon, Be'er Sheva LightRun, Herzliya Race, Kfar Saba Race, Petah Tikva Night Run, Yarkon Park Night Run, Tel Aviv Night Run, Sovev Emek, Winner Nesher, Mirotz Haifa, Eilat Desert Marathon, Winner Emek HaMa'ayanot, Beit She'an Marathon, Haifa Marathon, Tiberias Marathon, Ra'anana Mirotz, Holon Mirotz, Netanya Mirotz, and any other verified races.

**Data Requirements:** For every race:
- race_name, date (YYYY-MM-DD), city, distances_available, surface_type, official_website, description.

**Constraints:**
- Return strictly JSON matching the schema. No extra text.
- Include ALL races that match the criteria. Do not limit to 3–5.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    races: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          race_name: { type: 'STRING' },
          date: { type: 'STRING' },
          city: { type: 'STRING' },
          distances_available: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          surface_type: { type: 'STRING' },
          official_website: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['race_name', 'date', 'city'],
      },
    },
  },
  required: ['races'],
} as const

function buildPrompt(input: RaceSearchInput): string {
  const { dateFrom, dateTo, distances } = input
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-01-01`
  const defaultTo = `${now.getFullYear() + 1}-12-31`

  const fromStr = (dateFrom || defaultFrom).slice(0, 10)
  const toStr = (dateTo || defaultTo).slice(0, 10)

  let distStr = 'all distances'
  if (distances && distances.length > 0) {
    distStr = distances.join(', ')
  }

  return `Find all races in Israel between ${fromStr} and ${toStr} that include these distances: ${distStr}. Return the list as a JSON object with key "races".`
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

function mapToRaceResult(r: Record<string, unknown>): RaceResult {
  const dist = r.distances_available ?? r.distances
  const distArr = Array.isArray(dist) ? dist.map((d) => String(d)) : []
  const race: RaceResult = {
    name: String(r.race_name ?? r.name ?? 'Race'),
    date: String(r.date ?? '').slice(0, 10),
    city: String(r.city ?? ''),
    distances: distArr,
  }
  const url = r.official_website ?? r.registrationUrl
  if (url) race.registrationUrl = String(url)
  if (r.surface_type) race.surfaceType = String(r.surface_type)
  if (r.description) race.description = String(r.description)
  if (typeof r.latitude === 'number') race.latitude = r.latitude
  if (typeof r.longitude === 'number') race.longitude = r.longitude
  if (r.nameHe) race.nameHe = String(r.nameHe)
  return race
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
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
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

  return races.map((r) => mapToRaceResult(r as Record<string, unknown>))
}
