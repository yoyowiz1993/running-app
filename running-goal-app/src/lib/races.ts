import { getApiBase } from './garmin'

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

export type RaceSearchInput = {
  dateFrom?: string
  dateTo?: string
  distances?: string[]
}

/** Convert race distance label (e.g. "5K", "Half Marathon") to km. */
export function distanceLabelToKm(label: string): number | null {
  const s = label.trim().toLowerCase()
  if (s === '5k' || s === '5km') return 5
  if (s === '10k' || s === '10km') return 10
  if (s === '21k' || s === '21.1k' || s === '21km' || s.includes('half')) return 21.1
  if (s === '42k' || s === '42.2k' || s === '42km' || s.includes('marathon')) return 42.2
  const match = s.match(/^(\d+(?:\.\d+)?)\s*k(?:m)?$/)
  return match ? Number(match[1]) : null
}

export async function searchRaces(input: RaceSearchInput): Promise<RaceResult[]> {
  const base = await getApiBase()
  const res = await fetch(`${base}/api/races/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      distances: input.distances,
    }),
    credentials: 'omit',
    mode: 'cors',
  })
  const data = (await res.json()) as { races?: RaceResult[]; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Race search failed (${res.status})`)
  }
  return data.races ?? []
}
