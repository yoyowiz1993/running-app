const BUILD_TIME_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000'

let cachedBase: string | null = null

/** Resolve backend URL: config.json override, then build-time env, then localhost. */
export async function getApiBase(): Promise<string> {
  if (cachedBase) return cachedBase
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (res.ok) {
      const data = (await res.json()) as { apiBaseUrl?: string }
      if (data.apiBaseUrl && data.apiBaseUrl.trim()) {
        cachedBase = data.apiBaseUrl.trim().replace(/\/$/, '')
        return cachedBase
      }
    }
  } catch {
    // ignore
  }
  cachedBase = BUILD_TIME_BASE
  return cachedBase
}

export type GarminActivity = {
  id: string
  startTime: string
  distanceKm: number
  durationSec: number
  avgPaceSecPerKm: number
  source?: string
}

export async function fetchGarminActivities(): Promise<GarminActivity[]> {
  try {
    const base = await getApiBase()
    const res = await fetch(`${base}/api/activities`, {
      credentials: 'omit',
      mode: 'cors',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { activities?: GarminActivity[] }
    return data.activities ?? []
  } catch {
    return []
  }
}

export async function getGarminAuthUrl(): Promise<string> {
  const base = await getApiBase()
  return `${base}/auth/garmin/start`
}

