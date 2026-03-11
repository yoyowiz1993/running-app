// ── Types ─────────────────────────────────────────────────────────────────

export type StravaTokens = {
  access_token: string
  refresh_token: string
  expires_at: number // unix timestamp seconds
  athlete_id: number
  athlete_name: string
}

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

// ── OAuth helpers ─────────────────────────────────────────────────────────

export function buildStravaAuthUrl(userId: string): string {
  const clientId = process.env.STRAVA_CLIENT_ID
  const backendUrl = (process.env.BACKEND_URL || process.env.APP_URL || '').replace(/\/$/, '')
  if (!clientId || !backendUrl) {
    throw new Error('STRAVA_CLIENT_ID and BACKEND_URL must be set')
  }
  const redirectUri = `${backendUrl}/auth/strava/callback`
  const scope = 'read,activity:read'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope,
    state: userId,
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set')
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
    athlete?: { id?: number; firstname?: string; lastname?: string }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id ?? 0,
    athlete_name: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || 'Strava User',
  }
}

// ── Token refresh ─────────────────────────────────────────────────────────

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Strava credentials not configured')

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
    athlete?: { id?: number; firstname?: string; lastname?: string }
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: 0,
    athlete_name: '',
  }
}

// ── Activity fetching ─────────────────────────────────────────────────────

export async function fetchStravaActivitiesWithToken(
  accessToken: string,
): Promise<StravaActivity[]> {
  const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=30'
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava activities fetch failed: ${res.status} ${text}`)
  }

  const raw = await res.json() as Array<{
    id: number
    name: string
    type: string
    start_date_local: string
    distance: number
    moving_time: number
    elapsed_time: number
    average_speed: number
    total_elevation_gain: number
    average_heartrate?: number
    max_heartrate?: number
    calories?: number
  }>

  return raw
    .filter((a) => a.type === 'Run' || a.type === 'VirtualRun' || a.type === 'TrailRun')
    .map((a) => {
      const distanceKm = a.distance / 1000
      const avgPaceSecPerKm = distanceKm > 0 ? a.moving_time / distanceKm : 0
      const avgSpeedKph = (a.average_speed ?? 0) * 3.6

      return {
        id: a.id,
        name: a.name,
        startDateISO: a.start_date_local.slice(0, 10),
        distanceKm: Math.round(distanceKm * 100) / 100,
        movingSec: a.moving_time,
        elapsedSec: a.elapsed_time,
        avgPaceSecPerKm: Math.round(avgPaceSecPerKm),
        avgSpeedKph: Math.round(avgSpeedKph * 10) / 10,
        elevationGainM: Math.round(a.total_elevation_gain ?? 0),
        ...(a.average_heartrate != null ? { avgHeartRate: Math.round(a.average_heartrate) } : {}),
        ...(a.max_heartrate != null ? { maxHeartRate: Math.round(a.max_heartrate) } : {}),
        ...(a.calories != null && a.calories > 0 ? { calories: Math.round(a.calories) } : {}),
      }
    })
}
