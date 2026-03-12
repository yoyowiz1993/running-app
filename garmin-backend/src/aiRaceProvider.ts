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

const SYSTEM_PROMPT = `You are an expert sports event coordinator specializing in Israeli athletics and marathon logistics. Your task is to provide a comprehensive list of running races in Israel based on your knowledge.

**Objective:** For a given set of distances (e.g., 5K, 10K, 21.1K, 42.2K) and date range, find and return EVERY professional race in Israel scheduled in that period that includes those categories. Be comprehensive — return all races you know that match, including major marathons (Jerusalem, Tel Aviv, Dead Sea, Eilat, Haifa, Tiberias), night runs (Be'er Sheva LightRun, Petah Tikva, Tel Aviv Night Run, Yarkon Park), municipal Mirotz events (Herzliya, Kfar Saba, Haifa, Ra'anana, Holon, Netanya), trail runs (Sovev Emek), championship events (Winner Nesher 10K), and regional races. Do not limit to a few — return 10–20+ when the date range spans many months.

**Dates:** Use the most accurate dates from your knowledge. For recurring annual races, use the date from the official schedule you know (e.g. Jerusalem Marathon is typically late March, Tel Aviv Night Run in late October). When the exact day is uncertain, use the first day of the typical month. Never invent dates.

**Data Requirements:** For every race: race_name, date (YYYY-MM-DD), city, distances_available, surface_type, official_website, description.

**Constraints:**
- Return strictly JSON matching the schema. No extra text.
- Include ALL races that match the criteria. Only omit races you do not know about.`

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
  const apiKey = (process.env.AI_RACE_KEY || process.env.AI_API_KEY)?.trim()
  
  if (!apiKey) {
    throw new Error('AI_RACE_KEY or AI_API_KEY not configured')
  }

  const RACE_MODEL = 'gemini-3-flash'
  const url = `${GEMINI_BASE}/models/${RACE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
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
