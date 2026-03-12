import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildAuthUrl, exchangeCodeForToken, generatePKCE } from './garminAuth'
import { mockPushWorkouts, type PushWorkoutInput } from './workoutSync'
import { generatePlanFromAI } from './aiPlanProvider'
import { generateMealSuggestions } from './aiMealProvider'
import { searchRaces } from './aiRaceProvider'
import { validateAndNormalize } from './planSchema'
import {
  buildStravaAuthUrl,
  exchangeStravaCode,
  refreshStravaToken,
  fetchStravaActivitiesWithToken,
} from './stravaProvider'

dotenv.config()

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const app = express()

const allowedOriginRaw = process.env.ALLOWED_ORIGIN || '*'
const allowedOrigins = allowedOriginRaw.split(',').map((o) => o.trim()).filter(Boolean)
const corsOrigin = allowedOrigins.length === 0 || (allowedOrigins.length === 1 && allowedOrigins[0] === '*')
  ? '*'
  : allowedOrigins.length === 1
    ? allowedOrigins[0]
    : allowedOrigins
app.use(
  cors({
    origin: corsOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)
app.use(express.json())

const port = Number(process.env.PORT || 4000)
const clientId = process.env.GARMIN_CLIENT_ID
const clientSecret = process.env.GARMIN_CLIENT_SECRET
const backendUrl = (process.env.BACKEND_URL || process.env.APP_URL || '').replace(/\/$/, '')
const frontendUrl = (process.env.FRONTEND_URL || process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '')
const garminPushMode = (process.env.GARMIN_PUSH_MODE || 'mock').toLowerCase()

// In-memory store for PKCE state -> code_verifier (use DB in production)
const pendingAuth = new Map<string, { codeVerifier: string }>()

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/activities', (_req, res) => {
  res.json({ activities: [] })
})

const usdaApiKey = process.env.USDA_API_KEY
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

const aiApiKey = process.env.AI_API_KEY
const aiMealApiKey = process.env.AI_MEAL_API_KEY || aiApiKey

app.post('/api/programs/create', async (req, res) => {
  if (!aiApiKey?.trim()) {
    return res.status(503).json({
      error: 'AI program generation not configured. Set AI_API_KEY in the backend environment.',
      plan: null,
    })
  }
  const body = req.body as {
    goal?: { distanceKm?: number; targetPaceSecPerKm?: number; raceDateISO?: string }
    planName?: string
    startDate?: string
    endDate?: string
    runnerProfile?: {
      fitnessLevel?: string
      daysPerWeek?: number
      currentPaceSecPerKm?: number
      currentWeeklyKm?: number
      longestRecentRunKm?: number
    }
  }
  const goal = body?.goal
  const distanceKm = Number(goal?.distanceKm)
  const targetPaceSecPerKm = Number(goal?.targetPaceSecPerKm)
  const raceDateISO = String(goal?.raceDateISO ?? '').trim().slice(0, 10)
  const startDateStr = String(body?.startDate ?? '').trim().slice(0, 10)
  const endDateStr = String(body?.endDate ?? '').trim().slice(0, 10)

  if (!Number.isFinite(distanceKm) || distanceKm < 1 || distanceKm > 100) {
    return res.status(400).json({ error: 'Invalid goal.distanceKm (1–100 km)', plan: null })
  }
  if (!Number.isFinite(targetPaceSecPerKm) || targetPaceSecPerKm < 120 || targetPaceSecPerKm > 720) {
    return res.status(400).json({
      error: 'Invalid goal.targetPaceSecPerKm (120–720 sec/km, e.g. 300 = 5:00/km)',
      plan: null,
    })
  }
  if (raceDateISO.length !== 10) {
    return res.status(400).json({ error: 'Invalid goal.raceDateISO. Use yyyy-MM-dd.', plan: null })
  }
  if (startDateStr.length !== 10) {
    return res.status(400).json({ error: 'Invalid startDate. Use yyyy-MM-dd.', plan: null })
  }
  if (endDateStr.length !== 10) {
    return res.status(400).json({ error: 'Invalid endDate. Use yyyy-MM-dd.', plan: null })
  }

  try {
    const planNameInput = body.planName?.trim()
    const rp = body.runnerProfile
    const validLevels = ['beginner', 'intermediate', 'advanced'] as const
    const fitnessLevel = validLevels.includes(rp?.fitnessLevel as typeof validLevels[number])
      ? (rp!.fitnessLevel as typeof validLevels[number])
      : 'intermediate'
    const daysPerWeek = Math.max(2, Math.min(7, Number(rp?.daysPerWeek) || 4))
    const currentPaceSecPerKm = Number(rp?.currentPaceSecPerKm)
    const currentWeeklyKm = Number(rp?.currentWeeklyKm)
    const longestRecentRunKm = Number(rp?.longestRecentRunKm)

    const rawJson = await generatePlanFromAI({
      goal: { distanceKm, targetPaceSecPerKm, raceDateISO },
      startDate: startDateStr,
      endDate: endDateStr,
      ...(planNameInput ? { planName: planNameInput } : {}),
      runnerProfile: {
        fitnessLevel,
        daysPerWeek,
        ...(Number.isFinite(currentPaceSecPerKm) && currentPaceSecPerKm >= 120 && currentPaceSecPerKm <= 720 ? { currentPaceSecPerKm } : {}),
        ...(Number.isFinite(currentWeeklyKm) && currentWeeklyKm > 0 ? { currentWeeklyKm } : {}),
        ...(Number.isFinite(longestRecentRunKm) && longestRecentRunKm > 0 ? { longestRecentRunKm } : {}),
      },
    })
    const validated = validateAndNormalize(rawJson, startDateStr, endDateStr, {
      distanceKm,
      targetPaceSecPerKm,
      raceDateISO,
    })
    const { planId, startDateISO, endDateISO, goal: generatedGoal, workouts } = validated
    const generatedBy = 'ai' as const

    const planName = planNameInput || `Plan ${startDateISO}–${endDateISO}`

    const plan = {
      version: 1 as const,
      id: planId,
      generatedAtISO: new Date().toISOString(),
      startDateISO,
      raceDateISO,
      endDateISO,
      planName,
      source: 'ai' as const,
      generatedBy,
      goal: {
        distanceKm: generatedGoal.distanceKm,
        targetPaceSecPerKm: generatedGoal.targetPaceSecPerKm,
        raceDateISO: generatedGoal.raceDateISO,
        createdAtISO: generatedGoal.createdAtISO,
      },
      workouts: workouts.sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    }
    res.json({ plan })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Create program failed'
    console.warn('Program create error', err)
    res.status(502).json({ error: msg, plan: null })
  }
})


app.get('/api/nutrition/search', async (req, res) => {
  const q = (req.query.q as string)?.trim()
  if (!q || q.length < 2) {
    return res.json({ foods: [] })
  }
  if (!usdaApiKey) {
    return res.status(503).json({ error: 'USDA_API_KEY not configured', foods: [] })
  }
  try {
    const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, pageSize: 20 }),
    })
    const data = (await r.json()) as {
      foods?: Array<{
        fdcId: number
        description?: string
        foodPortions?: Array<{ amount?: number; unit?: string; gramWeight?: number }>
        foodNutrients?: Array<{ nutrientId?: number; nutrientName?: string; value?: number; unitName?: string }>
      }>
    }
    const foods = (data.foods ?? []).map((f) => {
      const calories = f.foodNutrients?.find((n) => n.nutrientId === 1008 || n.nutrientName?.toLowerCase().includes('energy'))
      const protein = f.foodNutrients?.find((n) => n.nutrientId === 1003 || n.nutrientName?.toLowerCase().includes('protein'))
      const carbs = f.foodNutrients?.find((n) => n.nutrientId === 1005 || n.nutrientName?.toLowerCase().includes('carb'))
      const fat = f.foodNutrients?.find((n) => n.nutrientId === 1004 || n.nutrientName?.toLowerCase().includes('fat'))
      return {
        id: String(f.fdcId),
        description: f.description ?? '',
        portions: (f.foodPortions ?? []).map((p) => ({
          amount: p.amount ?? 1,
          unit: p.unit ?? 'serving',
          gramWeight: p.gramWeight,
        })),
        calories: calories?.value ?? 0,
        protein: protein?.value ?? 0,
        carbs: carbs?.value ?? 0,
        fat: fat?.value ?? 0,
      }
    })
    res.json({ foods })
  } catch (err) {
    console.warn('USDA search error', err)
    res.status(502).json({ error: 'Search failed', foods: [] })
  }
})

app.post('/api/nutrition/suggest-meals', async (req, res) => {
  if (!aiMealApiKey?.trim()) {
    return res.status(503).json({ error: 'AI_API_KEY not configured', meals: [] })
  }
  const body = req.body as {
    goals?: { calories?: number; proteinPct?: number; carbsPct?: number; fatPct?: number }
    alreadyConsumed?: { calories?: number; protein?: number; carbs?: number; fat?: number }
    mealCount?: number
  }

  const goals = {
    calories: Math.round(Number(body?.goals?.calories) || 0),
    proteinPct: Math.round(Number(body?.goals?.proteinPct) || 0),
    carbsPct: Math.round(Number(body?.goals?.carbsPct) || 0),
    fatPct: Math.round(Number(body?.goals?.fatPct) || 0),
  }
  const alreadyConsumed = {
    calories: Math.round(Number(body?.alreadyConsumed?.calories) || 0),
    protein: Math.round(Number(body?.alreadyConsumed?.protein) || 0),
    carbs: Math.round(Number(body?.alreadyConsumed?.carbs) || 0),
    fat: Math.round(Number(body?.alreadyConsumed?.fat) || 0),
  }
  const mealCount = Math.max(1, Math.min(5, Math.round(Number(body?.mealCount) || 1)))

  if (goals.calories < 100 || goals.calories > 10000) {
    return res.status(400).json({ error: 'goals.calories must be between 100 and 10000', meals: [] })
  }
  const pctSum = goals.proteinPct + goals.carbsPct + goals.fatPct
  if (pctSum < 95 || pctSum > 105) {
    return res.status(400).json({ error: 'Macro percentages must sum to ~100%', meals: [] })
  }

  try {
    const meals = await generateMealSuggestions({ goals, alreadyConsumed, mealCount })
    res.json({ meals })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Meal suggestion failed'
    console.warn('Meal suggestion error', err)
    res.status(502).json({ error: msg, meals: [] })
  }
})

app.post('/api/races/search', async (req, res) => {
  if (!aiApiKey?.trim()) {
    return res.status(503).json({ error: 'AI_API_KEY not configured', races: [] })
  }
  const body = req.body as {
    dateFrom?: string
    dateTo?: string
    distances?: string[]
  }
  const dateFrom = String(body?.dateFrom ?? '').trim().slice(0, 10) || new Date().toISOString().slice(0, 10)
  const dateTo = String(body?.dateTo ?? '').trim().slice(0, 10) || ''
  const distances = Array.isArray(body?.distances) ? body.distances.filter((d): d is string => typeof d === 'string' && d.length > 0) : undefined

  try {
    const races = await searchRaces({ dateFrom, dateTo, distances })
    res.json({ races })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Race search failed'
    console.warn('Race search error', err)
    res.status(502).json({ error: msg, races: [] })
  }
})

app.post('/api/garmin/workouts/sync', (req, res) => {
  const body = req.body as { workouts?: PushWorkoutInput[] } | undefined
  const workouts = body?.workouts
  if (!Array.isArray(workouts)) {
    return res.status(400).json({ ok: false, message: 'Expected { workouts: [] } payload' })
  }
  if (workouts.length === 0) return res.json({ ok: true, mode: garminPushMode, results: [] })

  if (garminPushMode !== 'mock') {
    return res.status(501).json({
      ok: false,
      message:
        'Garmin push is not enabled yet for this backend mode. Set GARMIN_PUSH_MODE=mock or implement live adapter.',
    })
  }

  const results = mockPushWorkouts(workouts)
  return res.json({ ok: true, mode: garminPushMode, results })
})

app.get('/auth/garmin/start', (req, res) => {
  if (!clientId || !clientSecret) {
    return res.status(501).json({
      ok: false,
      message:
        'Garmin OAuth not configured. Set GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET in the backend environment.',
    })
  }
  if (!backendUrl) {
    return res.status(500).json({
      ok: false,
      message: 'Set BACKEND_URL (or APP_URL) to this server’s public URL, e.g. https://garmin-backend-xxx.onrender.com',
    })
  }

  const redirectUri = `${backendUrl}/auth/garmin/callback`
  const { codeVerifier, codeChallenge, state } = generatePKCE()
  pendingAuth.set(state, { codeVerifier })
  setTimeout(() => pendingAuth.delete(state), 10 * 60 * 1000)

  const authUrl = buildAuthUrl({
    clientId,
    redirectUri,
    codeChallenge,
    state,
  })
  res.redirect(302, authUrl)
})

app.get('/auth/garmin/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string }
  const redirectToFrontend = frontendUrl
    ? `${frontendUrl}#/settings?garmin=`
    : '#/settings?garmin='

  if (!code || !state) {
    return res.redirect(302, redirectToFrontend + 'error&message=missing_code_or_state')
  }

  const pending = pendingAuth.get(state)
  pendingAuth.delete(state)
  if (!pending || !clientId || !clientSecret || !backendUrl) {
    return res.redirect(302, redirectToFrontend + 'error&message=invalid_state_or_config')
  }

  try {
    const redirectUri = `${backendUrl}/auth/garmin/callback`
    const tokens = await exchangeCodeForToken({
      clientId,
      clientSecret,
      code,
      codeVerifier: pending.codeVerifier,
      redirectUri,
    })
    // TODO: store tokens (e.g. in DB keyed by user) and use for /api/activities
    // For now we just signal success; frontend can set localStorage flag
    console.log('Garmin OAuth success, access_token received')
    return res.redirect(302, redirectToFrontend + 'connected')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed'
    return res.redirect(302, redirectToFrontend + 'error&message=' + encodeURIComponent(message))
  }
})

// ── Strava OAuth ────────────────────────────────────────────────────────────

app.get('/auth/strava/start', (req, res) => {
  const userId = (req.query.user_id as string | undefined)?.trim()
  if (!userId) {
    return res.status(400).json({ ok: false, message: 'user_id query param required' })
  }
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res.status(501).json({ ok: false, message: 'Strava credentials not configured on backend' })
  }
  try {
    const url = buildStravaAuthUrl(userId)
    res.redirect(302, url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, message: msg })
  }
})

app.get('/auth/strava/callback', async (req, res) => {
  const { code, state: userId, error } = req.query as {
    code?: string
    state?: string
    error?: string
  }
  const base = frontendUrl || ''
  const errorRedirect = (msg: string) =>
    res.redirect(302, `${base}#/settings?strava=error&message=${encodeURIComponent(msg)}`)

  if (error || !code || !userId) {
    return errorRedirect(error ?? 'missing_code')
  }

  try {
    const tokens = await exchangeStravaCode(code)
    // Pass tokens to frontend via URL hash — frontend stores them in Supabase
    const params = new URLSearchParams({
      strava: 'connected',
      at: tokens.access_token,
      rt: tokens.refresh_token,
      ea: String(tokens.expires_at),
      aid: String(tokens.athlete_id),
      an: tokens.athlete_name,
    })
    return res.redirect(302, `${base}#/settings?${params.toString()}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'token_exchange_failed'
    return errorRedirect(msg)
  }
})

// ── Strava activity routes ───────────────────────────────────────────────────

app.post('/api/strava/activities', async (req, res) => {
  const body = req.body as {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
  const { accessToken, refreshToken, expiresAt } = body

  if (!accessToken || !refreshToken) {
    return res.status(400).json({ ok: false, message: 'accessToken and refreshToken required', activities: [] })
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000)
    let activeToken = accessToken
    let newTokens: { accessToken: string; refreshToken: string; expiresAt: number } | undefined

    // Refresh if token is expired or expiring within 5 minutes
    if (!expiresAt || expiresAt < nowSec + 300) {
      const refreshed = await refreshStravaToken(refreshToken)
      activeToken = refreshed.access_token
      newTokens = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
      }
    }

    const activities = await fetchStravaActivitiesWithToken(activeToken)
    res.json({ ok: true, activities, ...(newTokens ? { newTokens } : {}) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch activities'
    res.status(502).json({ ok: false, message: msg, activities: [] })
  }
})

app.listen(port, () => {
  console.log(`Garmin backend listening on http://localhost:${port}`)
})

