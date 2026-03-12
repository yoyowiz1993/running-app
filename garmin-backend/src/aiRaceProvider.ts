/**
 * AI provider for searching running races in Israel.
 * Uses AI_RACE_KEY (or AI_API_KEY fallback), Gemini 2.5 Flash, and Google Search grounding for exact dates.
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

/**
 * Optimized system prompt: site-specific Israeli sources (shvoong, 4sport, realtiming),
 * anchor races verification, and strict exclusion clause to prevent hallucinated dates.
 */
const SYSTEM_PROMPT = `You are an expert sports data extraction assistant. Your strict task is to compile a verified JSON list of running races in Israel occurring within the date range and distance filters provided by the user.

CRITICAL INSTRUCTIONS TO PREVENT HALLUCINATIONS:

1. TARGETED SEARCH REQUIRED: Your training data is outdated. You MUST use Google Search to find the dates for the specified year(s).
2. USE LOCAL ISRAELI SOURCES: Search specific Israeli race aggregators and timing sites. Use search queries like: "site:shvoong.co.il [YEAR]", "site:4sport.co.il [YEAR]", "site:realtiming.co.il [YEAR]", or "Marathon Israel [YEAR] dates".
3. VERIFY MAJOR RACES: Specifically search for the official dates of the Tel Aviv Marathon, Jerusalem Marathon, Tiberias Marathon, Dead Sea Marathon, and Eilat Desert Marathon.
4. STRICT EXCLUSION: If you cannot find a confirmed YYYY-MM-DD date on an official website, news article, or timing portal, DO NOT include the race. Guessing is strictly prohibited.

DATA REQUIREMENTS:
- Distances: Only include events offering at least one of: 5K, 10K, 21.1K, 42.2K (or the distances specified by the user).
- Date Format: YYYY-MM-DD exactly.

OUTPUT FORMAT:
Return ONLY a valid JSON object with the key "races". No conversational text before or after the JSON.

Expected format:
{
  "races": [
    {
      "race_name": "...",
      "date": "YYYY-MM-DD",
      "city": "...",
      "distances_available": ["5K", "10K", ...],
      "surface_type": "road",
      "official_website": "https://...",
      "description": "..."
    }
  ]
}`

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

  let distStr = '5K, 10K, 21.1K, 42.2K'
  if (distances && distances.length > 0) {
    distStr = distances.join(', ')
  }

  return `Compile a verified list of running races in Israel occurring between ${fromStr} and ${toStr}. Distances: ${distStr}. Use site:shvoong.co.il, site:4sport.co.il, and site:realtiming.co.il to find confirmed dates. STRICT: Only include races where you found a confirmed YYYY-MM-DD on an official source. Return ONLY valid JSON with key "races".`
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

const RACE_MODEL = 'gemini-2.5-flash'

export async function searchRaces(input: RaceSearchInput): Promise<RaceResult[]> {
  const apiKey = (process.env.AI_RACE_KEY || process.env.AI_API_KEY)?.trim()
  if (!apiKey) {
    throw new Error('AI_RACE_KEY or AI_API_KEY not configured')
  }

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
