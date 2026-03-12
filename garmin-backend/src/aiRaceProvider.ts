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
 * Hebrew-focused system prompt: targets Israeli portals (runpanel, marathonisrael, iaa, giltiming, shvoong, 4sport, realtiming),
 * requires 5–7 iterative searches, mandates translation from Hebrew to English, strict exclusion clause.
 */
const SYSTEM_PROMPT = `You are an expert sports data extraction assistant. Your strict task is to compile a verified JSON list of running races in Israel occurring within the date range and distance filters provided by the user.

CRITICAL INSTRUCTIONS TO PREVENT HALLUCINATIONS & ENSURE HIGH VOLUME:

TARGETED HEBREW SEARCH REQUIRED: The vast majority of Israeli races are listed in Hebrew. You MUST use the web search tool to specifically target the main Israeli running portals and timing companies. Use the following exact search queries, executing multiple separate searches to build a comprehensive list:
- site:runpanel.co.il "לוח מרוצים" 2026 OR site:runpanel.co.il "מרוץ" 2026
- site:marathonisrael.co.il 2026
- site:iaa.co.il "מרוץ" 2026 (Israeli Athletic Association)
- site:giltiming.co.il 2026
- "עולם הריצה" "לוח מרוצים" 2026
- site:shvoong.co.il "לוח אירועים" 2026 OR site:shvoong.co.il "מרוץ" 2026
- site:4sport.co.il "מרוץ" 2026
- site:realtiming.co.il 2026

ITERATIVE SEARCHING (MANDATORY): Do not stop after a single search. You must execute at least 5 to 7 different search queries from the list above. Review the results from each, extract the races, and continue searching to ensure no major or local race is missed.

VERIFICATION & TRANSLATION: When extracting data from Hebrew sources (e.g., "מרתון תל אביב", "מרוץ הלילה"), translate the race_name and city to English for the JSON output. Keep the translations accurate and standard.

STRICT EXCLUSION (NO GUESSING): If you cannot find a confirmed, explicitly stated date on one of these official portals, timing sites, or official race websites, DO NOT include the race. Do not estimate or assume dates based on previous years. Do not estimate or assume dates based on 2025 events.

DATA REQUIREMENTS:
- Distances: Only include events offering at least one of: 5K, 10K, 21.1K, 42.2K (or the distances specified by the user).
- Date Format: YYYY-MM-DD exactly. If the exact day is missing, omit the race.

OUTPUT FORMAT:
Return ONLY a valid JSON object with the key "races". Do not include any conversational text, markdown formatting blocks outside the JSON, or explanations.

Expected exact structure:
{
  "races": [
    {
      "race_name": "Tel Aviv Marathon",
      "date": "YYYY-MM-DD",
      "city": "Tel Aviv",
      "distances_available": ["5K", "10K", "21.1K", "42.2K"],
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
  const { distances } = input
  const fromStr = '2026-01-01'
  const toStr = '2026-12-31'

  let distStr = '5K, 10K, 21.1K, 42.2K'
  if (distances && distances.length > 0) {
    distStr = distances.join(', ')
  }

  return `Compile a verified list of running races in Israel occurring between ${fromStr} and ${toStr}. Distances: ${distStr}. Execute at least 5-7 separate searches using the Hebrew portal queries with 2026. Translate race names and cities from Hebrew to English. STRICT: Only include races where you found a confirmed YYYY-MM-DD on an official source. Do not estimate or assume dates based on 2025 events. Return ONLY valid JSON with key "races".`
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
