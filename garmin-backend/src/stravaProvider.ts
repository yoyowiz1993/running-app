import { createClient } from '@supabase/supabase-js'

// ── Supabase client (service role — backend only) ─────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

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
  startDateISO: string       // YYYY-MM-DD
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

export async function exchangeStravaCode(
  code: string,
  userId: string,
): Promise<StravaTokens> {
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

  const tokens: StravaTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id ?? 0,
    athlete_name: [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || 'Strava User',
  }

  await saveTokens(userId, tokens)
  return tokens
}

// ── Token storage ─────────────────────────────────────────────────────────

async function saveTokens(userId: string, tokens: StravaTokens): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('Supabase not configured — Strava tokens will not be persisted')
    return
  }
  const { error } = await supabase
    .from('user_state')
    .upsert({
      user_id: userId,
      strava_access_token: tokens.access_token,
      strava_refresh_token: tokens.refresh_token,
      strava_expires_at: tokens.expires_at,
      strava_athlete_id: tokens.athlete_id,
      strava_athlete_name: tokens.athlete_name,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) console.warn('Failed to save Strava tokens:', error.message)
}

async function loadTokens(userId: string): Promise<StravaTokens | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_state')
    .select('strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id, strava_athlete_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.strava_access_token) return null
  return {
    access_token: data.strava_access_token as string,
    refresh_token: data.strava_refresh_token as string,
    expires_at: data.strava_expires_at as number,
    athlete_id: (data.strava_athlete_id as number) ?? 0,
    athlete_name: (data.strava_athlete_name as string) ?? '',
  }
}

async function refreshIfNeeded(userId: string, tokens: StravaTokens): Promise<StravaTokens> {
  const nowSec = Math.floor(Date.now() / 1000)
  if (tokens.expires_at > nowSec + 300) return tokens // still valid with 5 min buffer

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Strava credentials not configured')

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  const refreshed: StravaTokens = {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  }

  await saveTokens(userId, refreshed)
  return refreshed
}

// ── Activity fetching ─────────────────────────────────────────────────────

export async function fetchStravaActivities(userId: string): Promise<StravaActivity[]> {
  const tokens = await loadTokens(userId)
  if (!tokens) throw new Error('Strava not connected for this user')

  const fresh = await refreshIfNeeded(userId, tokens)

  // Fetch last 30 activities (covers ~1 month of training)
  const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=30'
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${fresh.access_token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava activities fetch failed: ${res.status} ${text}`)
  }

  const raw = await res.json() as Array<{
    id: number
    name: string
    type: string
    start_date_local: string   // ISO with time, local
    distance: number           // meters
    moving_time: number        // seconds
    elapsed_time: number       // seconds
    average_speed: number      // m/s
    total_elevation_gain: number // meters
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

export async function getStravaConnectionStatus(userId: string): Promise<{ connected: boolean; athleteName?: string }> {
  const tokens = await loadTokens(userId)
  if (!tokens) return { connected: false }
  return { connected: true, athleteName: tokens.athlete_name }
}
