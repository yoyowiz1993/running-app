import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: ReturnType<typeof createClient> | null = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

export type GarminTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export async function saveGarminTokens(userId: string, tokens: GarminTokens): Promise<void> {
  if (!supabase) return
  const payload = {
    user_id: userId,
    garmin_access_token: tokens.accessToken,
    garmin_refresh_token: tokens.refreshToken ?? null,
    garmin_expires_at: tokens.expiresAt ?? null,
    updated_at: new Date().toISOString(),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('user_state') as any).upsert(payload, { onConflict: 'user_id' })
}

export async function loadGarminTokens(userId: string): Promise<GarminTokens | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('user_state')
    .select('garmin_access_token, garmin_refresh_token, garmin_expires_at')
    .eq('user_id', userId)
    .maybeSingle() as { data: { garmin_access_token?: string; garmin_refresh_token?: string; garmin_expires_at?: number } | null }
  const row = data as { garmin_access_token?: string; garmin_refresh_token?: string; garmin_expires_at?: number } | null
  if (!row?.garmin_access_token) return null
  const result: GarminTokens = { accessToken: row.garmin_access_token }
  if (row.garmin_refresh_token != null) result.refreshToken = row.garmin_refresh_token
  if (row.garmin_expires_at != null) result.expiresAt = row.garmin_expires_at
  return result
}
