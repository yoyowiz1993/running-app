const BUILD_TIME_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000'

let cachedBase: string | null = null

/** Resolve backend URL: config.json override, then build-time env, then localhost. */
export async function getApiBase(): Promise<string> {
  if (cachedBase) return cachedBase
  try {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
    const path = base ? `${base}/config.json` : '/config.json'
    const res = await fetch(path, { cache: 'no-store' })
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

export type GarminPushWorkoutInput = {
  workoutId: string
  dateISO: string
  title: string
  type: string
  plannedDistanceKm?: number
  totalDurationSec: number
  stages: Array<{
    label: string
    kind: string
    durationSec: number
    targetPaceSecPerKm?: number
  }>
}

export type GarminPushResult = {
  workoutId: string
  status: 'queued' | 'synced' | 'failed'
  externalId?: string
  message?: string
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

export async function getGarminAuthUrl(userId: string): Promise<string> {
  const base = await getApiBase()
  return `${base}/auth/garmin/start?user_id=${encodeURIComponent(userId)}`
}

export async function pushWorkoutsToGarmin(
  workouts: GarminPushWorkoutInput[],
): Promise<GarminPushResult[]> {
  if (workouts.length === 0) return []
  try {
    const base = await getApiBase()
    const res = await fetch(`${base}/api/garmin/workouts/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workouts }),
      credentials: 'omit',
      mode: 'cors',
    })
    if (!res.ok) {
      const text = await res.text()
      return workouts.map((w) => ({
        workoutId: w.workoutId,
        status: 'failed',
        message: `Backend error: ${res.status} ${text.slice(0, 80)}`,
      }))
    }
    const data = (await res.json()) as { results?: GarminPushResult[] }
    return data.results ?? []
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return workouts.map((w) => ({
      workoutId: w.workoutId,
      status: 'failed',
      message,
    }))
  }
}

