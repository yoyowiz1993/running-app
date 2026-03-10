/**
 * Intervals.icu API adapter for importing planned workouts.
 * Auth: Basic API_KEY:<apiKey>
 * Docs: https://forum.intervals.icu/t/api-access-to-intervals-icu/609
 */

const INTERVALS_BASE = 'https://intervals.icu'

export type IntervalsEvent = {
  id?: number
  start_date_local?: string
  end_date_local?: string
  name?: string
  description?: string
  type?: string
  category?: string
  moving_time?: number
  workout_doc?: {
    steps?: Array<{
      duration?: number
      pace?: { units?: string; value?: number }
      power?: { units?: string; value?: number }
    }>
    duration?: number
  }
}

export type IntervalsWorkout = {
  id?: number
  name?: string
  description?: string
  type?: string
  category?: string
  moving_time?: number
  workout_doc?: IntervalsEvent['workout_doc']
}

function parsePaceToSecPerKm(pace: { units?: string; value?: number } | undefined): number | undefined {
  if (!pace || typeof pace.value !== 'number') return undefined
  const v = pace.value
  const u = (pace.units ?? '').toLowerCase()
  if (u.includes('km') || u === 'min/km') return Math.round(v * 60)
  if (u.includes('kph') || u === 'km/h') return v > 0 ? Math.round(3600 / v) : undefined
  return Math.round(v * 60)
}

type StepShape = { duration?: number; pace?: { units?: string; value?: number } }

function mapStepToStage(step: StepShape | undefined, idx: number): { label: string; kind: string; durationSec: number; targetPaceSecPerKm?: number } {
  const durationSec = Math.max(0, Math.round(step?.duration ?? 0))
  const pace = parsePaceToSecPerKm(step?.pace)
  let label = `Step ${idx + 1}`
  if (step?.pace) label = `${Math.round((pace ?? 0) / 60)}:${String((pace ?? 0) % 60).padStart(2, '0')}/km`
  return {
    label,
    kind: 'easy',
    durationSec: durationSec || 60,
    ...(pace ? { targetPaceSecPerKm: pace } : {}),
  }
}

export function mapIntervalsEventToWorkout(
  evt: IntervalsEvent,
  newId: (prefix: string) => string,
  dateISOOverride?: string,
): {
  id: string
  dateISO: string
  title: string
  type: 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'rest'
  stages: Array<{ id: string; label: string; kind: string; durationSec: number; targetPaceSecPerKm?: number }>
  totalDurationSec: number
} {
  const dateStr = dateISOOverride ?? (evt.start_date_local ?? '').slice(0, 10)
  const movingSec = evt.moving_time ?? evt.workout_doc?.duration ?? 0
  const steps = evt.workout_doc?.steps ?? []

  let stages: Array<{ id: string; label: string; kind: string; durationSec: number; targetPaceSecPerKm?: number }>
  if (steps.length > 0) {
    stages = steps.map((s, i) => {
      const mapped = mapStepToStage(s, i)
      return { ...mapped, id: newId('stage') }
    })
  } else {
    stages = [
      {
        id: newId('stage'),
        label: evt.name ?? 'Main',
        kind: 'easy',
        durationSec: Math.max(60, Math.round(movingSec)),
      },
    ]
  }

  const totalDurationSec = stages.reduce((a, s) => a + s.durationSec, 0)

  let workoutType: 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'rest' = 'easy'
  const name = (evt.name ?? '').toLowerCase()
  if (name.includes('interval') || name.includes('vo2') || name.includes('threshold')) workoutType = 'intervals'
  else if (name.includes('tempo') || name.includes('threshold')) workoutType = 'tempo'
  else if (name.includes('long')) workoutType = 'long'
  else if (name.includes('race')) workoutType = 'race'

  return {
    id: newId('workout'),
    dateISO: dateStr || new Date().toISOString().slice(0, 10),
    title: evt.name ?? 'Imported workout',
    type: workoutType,
    stages,
    totalDurationSec: totalDurationSec || Math.round(movingSec),
  }
}

export function mapIntervalsLibraryWorkoutToWorkout(
  item: IntervalsWorkout,
  newId: (prefix: string) => string,
  dateISO: string,
) {
  const evt: IntervalsEvent = { start_date_local: `${dateISO}T00:00:00` }
  if (item.name !== undefined) evt.name = item.name
  if (item.description !== undefined) evt.description = item.description
  if (item.type !== undefined) evt.type = item.type
  if (item.category !== undefined) evt.category = item.category
  if (item.moving_time !== undefined) evt.moving_time = item.moving_time
  if (item.workout_doc !== undefined) evt.workout_doc = item.workout_doc
  return mapIntervalsEventToWorkout(evt, newId, dateISO)
}

export async function fetchIntervalsEvents(
  apiKey: string,
  oldest: string,
  newest: string,
): Promise<IntervalsEvent[]> {
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const url = `${INTERVALS_BASE}/api/v1/athlete/0/events?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Intervals.icu API error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as IntervalsEvent[]
  return Array.isArray(data) ? data : []
}

export async function fetchIntervalsWorkouts(apiKey: string): Promise<IntervalsWorkout[]> {
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const url = `${INTERVALS_BASE}/api/v1/athlete/0/workouts`
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Intervals.icu workouts API error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as IntervalsWorkout[]
  return Array.isArray(data) ? data : []
}
