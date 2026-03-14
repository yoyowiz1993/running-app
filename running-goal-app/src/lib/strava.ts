import { getApiBase } from './garmin'
import { supabase } from './supabase'
import { showToast } from './toast'
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

export type StravaTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  athleteId: number
  athleteName: string
}

// ── Token storage via frontend Supabase client ─────────────────────────────

export async function saveStravaTokens(userId: string, tokens: StravaTokens): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('user_state').upsert(
    {
      user_id: userId,
      strava_access_token: tokens.accessToken,
      strava_refresh_token: tokens.refreshToken,
      strava_expires_at: tokens.expiresAt,
      strava_athlete_id: tokens.athleteId,
      strava_athlete_name: tokens.athleteName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('Failed to save Strava tokens:', error.message)
    showToast(`Could not save Strava connection: ${error.message}`, 'error')
  }
}

export async function loadStravaTokens(userId: string): Promise<StravaTokens | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_state')
    .select('strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id, strava_athlete_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.strava_access_token) return null
  return {
    accessToken: data.strava_access_token as string,
    refreshToken: data.strava_refresh_token as string,
    expiresAt: (data.strava_expires_at as number) ?? 0,
    athleteId: (data.strava_athlete_id as number) ?? 0,
    athleteName: (data.strava_athlete_name as string) ?? '',
  }
}

export async function clearStravaTokens(userId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('user_state').update({
    strava_access_token: null,
    strava_refresh_token: null,
    strava_expires_at: null,
    strava_athlete_id: null,
    strava_athlete_name: null,
  }).eq('user_id', userId)
}

// ── Auth URL ───────────────────────────────────────────────────────────────

export async function getStravaAuthUrl(userId: string): Promise<string> {
  const base = await getApiBase()
  return `${base}/auth/strava/start?user_id=${encodeURIComponent(userId)}`
}

export async function fetchStravaConnectionStatus(
  userId: string,
): Promise<{ connected: boolean; athleteName?: string }> {
  const tokens = await loadStravaTokens(userId)
  if (!tokens) return { connected: false }
  return { connected: true, athleteName: tokens.athleteName }
}

// ── Activity fetching ──────────────────────────────────────────────────────

export async function fetchStravaActivities(userId: string): Promise<StravaActivity[]> {
  const tokens = await loadStravaTokens(userId)
  if (!tokens) throw new Error('Strava not connected. Go to Account → Connect Strava.')

  const base = await getApiBase()
  const res = await fetch(`${base}/api/strava/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    mode: 'cors',
    body: JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(data.message ?? `Strava fetch failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    activities?: StravaActivity[]
    newTokens?: { accessToken: string; refreshToken: string; expiresAt: number }
  }

  // If the backend refreshed the token, update storage
  if (data.newTokens) {
    await saveStravaTokens(userId, {
      ...tokens,
      accessToken: data.newTokens.accessToken,
      refreshToken: data.newTokens.refreshToken,
      expiresAt: data.newTokens.expiresAt,
    })
  }

  return data.activities ?? []
}

// ── Workout matching ────────────────────────────────────────────────────────

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
    }
    // Fall back to date-only match
    if (!best) best = dayActivities[0]

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
