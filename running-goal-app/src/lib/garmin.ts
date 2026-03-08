const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000'

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
    const res = await fetch(`${API_BASE}/api/activities`, {
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

export function getGarminAuthUrl(): string {
  return `${API_BASE}/auth/garmin/start`
}

