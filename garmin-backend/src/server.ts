import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildAuthUrl, exchangeCodeForToken, generatePKCE } from './garminAuth'
import { mockPushWorkouts, type PushWorkoutInput } from './workoutSync'
import { fetchIntervalsEvents, mapIntervalsEventToWorkout } from './intervalsIcu'

dotenv.config()

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const app = express()

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
app.use(
  cors({
    origin: allowedOrigin,
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

app.post('/api/intervals/import', async (req, res) => {
  const body = req.body as { apiKey?: string; oldest?: string; newest?: string; planName?: string }
  const apiKey = body?.apiKey?.trim()
  const oldest = (body?.oldest ?? '').trim().slice(0, 10)
  const newest = (body?.newest ?? '').trim().slice(0, 10)
  if (!apiKey || oldest.length !== 10 || newest.length !== 10) {
    return res.status(400).json({
      error: 'Missing or invalid apiKey, oldest, newest. Use yyyy-MM-dd dates.',
      plan: null,
    })
  }
  try {
    const events = await fetchIntervalsEvents(apiKey, oldest, newest)
    const runEvents = events.filter(
      (e) =>
        (e.type ?? '').toLowerCase() === 'run' &&
        (e.category === 'WORKOUT' || e.category === 'RACE' || !e.category),
    )
    const workouts = runEvents.map((e) => mapIntervalsEventToWorkout(e, newId))
    const startDate = workouts[0]?.dateISO ?? oldest
    const endDate = workouts[workouts.length - 1]?.dateISO ?? newest
    const plan = {
      version: 1,
      id: newId('plan'),
      generatedAtISO: new Date().toISOString(),
      startDateISO: startDate,
      raceDateISO: endDate,
      endDateISO: endDate,
      planName: body.planName?.trim() || `Intervals.icu ${oldest}–${newest}`,
      source: 'intervals_icu',
      goal: {
        distanceKm: 10,
        targetPaceSecPerKm: 300,
        raceDateISO: endDate,
        createdAtISO: new Date().toISOString(),
      },
      workouts: workouts.sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    }
    res.json({ plan, eventsCount: runEvents.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import failed'
    console.warn('Intervals.icu import error', err)
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

app.listen(port, () => {
  console.log(`Garmin backend listening on http://localhost:${port}`)
})

