import { getApiBase } from './garmin'
import type { Workout } from './types'

export type StravaActivity = {
  id: number
  name: string
  startDateISO: string
  distanceKm: number
  movingSec: number
  elapsedSec: number
  avgPaceSecPerKm: number
  avgSpeedKph: number
  elevationGainM: number
  avgHeartRate?: number
  maxHeartRate?: number
  calories?: number
}

export async function getStravaAuthUrl(userId: string): Promise<string> {
  const base = await getApiBase()
  return `${base}/auth/strava/start?user_id=${encodeURIComponent(userId)}`
}

export async function fetchStravaConnectionStatus(
  userId: string,
): Promise<{ connected: boolean; athleteName?: string }> {
  try {
    const base = await getApiBase()
    const res = await fetch(`${base}/api/strava/status?user_id=${encodeURIComponent(userId)}`, {
      credentials: 'omit',
      mode: 'cors',
    })
    if (!res.ok) return { connected: false }
    const data = (await res.json()) as { connected?: boolean; athleteName?: string }
    return { connected: !!data.connected, athleteName: data.athleteName }
  } catch {
    return { connected: false }
  }
}

export async function fetchStravaActivities(userId: string): Promise<StravaActivity[]> {
  const base = await getApiBase()
  const res = await fetch(`${base}/api/strava/activities?user_id=${encodeURIComponent(userId)}`, {
    credentials: 'omit',
    mode: 'cors',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(data.message ?? `Strava fetch failed: ${res.status}`)
  }
  const data = (await res.json()) as { activities?: StravaActivity[] }
  return data.activities ?? []
}

/**
 * Match Strava activities to workouts:
 *   - Same calendar date AND actual distance within 25% of planned distance
 *   - If no plannedDistanceKm, match by date only
 */
export function matchActivitiesToWorkouts(
  workouts: Workout[],
  activities: StravaActivity[],
): Map<string, StravaActivity> {
  const matches = new Map<string, StravaActivity>()
  const usedActivityIds = new Set<number>()

  for (const workout of workouts) {
    if (workout.type === 'rest') continue
    const dayActivities = activities.filter(
      (a) => a.startDateISO === workout.dateISO && !usedActivityIds.has(a.id),
    )
    if (dayActivities.length === 0) continue

    let best: StravaActivity | undefined

    if (workout.plannedDistanceKm && workout.plannedDistanceKm > 0) {
      const planned = workout.plannedDistanceKm
      best = dayActivities.find((a) => {
        const ratio = a.distanceKm / planned
        return ratio >= 0.75 && ratio <= 1.25
      })
    } else {
      best = dayActivities[0]
    }

    if (best) {
      matches.set(workout.id, best)
      usedActivityIds.add(best.id)
    }
  }

  return matches
}

export function applyStravaMatchesToWorkouts(
  workouts: Workout[],
  matches: Map<string, StravaActivity>,
): Workout[] {
  return workouts.map((w) => {
    const activity = matches.get(w.id)
    if (!activity) return w
    return {
      ...w,
      completedAtISO: w.completedAtISO ?? new Date().toISOString(),
      stravaActivityId: activity.id,
      stravaActivityName: activity.name,
      stravaDistanceKm: activity.distanceKm,
      stravaMovingSec: activity.movingSec,
      stravaElapsedSec: activity.elapsedSec,
      stravaAvgPaceSecPerKm: activity.avgPaceSecPerKm,
      stravaAvgSpeedKph: activity.avgSpeedKph,
      stravaElevationGainM: activity.elevationGainM,
      ...(activity.avgHeartRate != null ? { stravaAvgHeartRate: activity.avgHeartRate } : {}),
      ...(activity.maxHeartRate != null ? { stravaMaxHeartRate: activity.maxHeartRate } : {}),
      ...(activity.calories != null ? { stravaCalories: activity.calories } : {}),
      stravaSyncStatus: 'synced' as const,
      stravaSyncedAtISO: new Date().toISOString(),
    }
  })
}
