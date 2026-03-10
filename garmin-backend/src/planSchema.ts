/**
 * Strict schema validation and normalization for AI-generated training plans.
 * Ensures output is compatible with frontend TrainingPlan/Workout types.
 */

import { isValid, parseISO } from 'date-fns'

const WORKOUT_TYPES = ['easy', 'long', 'tempo', 'intervals', 'race', 'rest'] as const
const STAGE_KINDS = ['warmup', 'easy', 'tempo', 'interval', 'recovery', 'cooldown', 'race', 'rest'] as const

export type WorkoutType = (typeof WORKOUT_TYPES)[number]
export type StageKind = (typeof STAGE_KINDS)[number]

export type ValidatedStage = {
  id: string
  label: string
  kind: StageKind
  durationSec: number
  targetPaceSecPerKm?: number
}

export type ValidatedWorkout = {
  id: string
  dateISO: string
  title: string
  type: WorkoutType
  plannedDistanceKm?: number
  stages: ValidatedStage[]
  totalDurationSec: number
}

export type ValidatedPlan = {
  planId: string
  startDateISO: string
  endDateISO: string
  goal: { distanceKm: number; targetPaceSecPerKm: number; raceDateISO: string; createdAtISO: string }
  workouts: ValidatedWorkout[]
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function clampPace(secPerKm: number): number {
  return Math.min(Math.max(Math.round(secPerKm), 120), 720)
}

function normalizeType(val: unknown): WorkoutType {
  const s = String(val ?? '').toLowerCase().trim()
  if (WORKOUT_TYPES.includes(s as WorkoutType)) return s as WorkoutType
  if (s.includes('interval') || s.includes('vo2')) return 'intervals'
  if (s.includes('tempo') || s.includes('threshold')) return 'tempo'
  if (s.includes('long')) return 'long'
  if (s.includes('race')) return 'race'
  if (s.includes('rest')) return 'rest'
  return 'easy'
}

function normalizeStageKind(val: unknown): StageKind {
  const s = String(val ?? '').toLowerCase().trim()
  if (STAGE_KINDS.includes(s as StageKind)) return s as StageKind
  if (s.includes('warm') || s.includes('warmup')) return 'warmup'
  if (s.includes('cool') || s.includes('cooldown')) return 'cooldown'
  if (s.includes('interval') || s.includes('hard')) return 'interval'
  if (s.includes('recovery') || s.includes('rest') || s.includes('easy')) return 'recovery'
  if (s.includes('tempo')) return 'tempo'
  if (s.includes('race')) return 'race'
  return 'easy'
}

function parseAndExtractJson(raw: string): { workouts?: unknown[] } {
  let text = raw.trim()
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    text = text.slice(jsonStart, jsonEnd + 1)
  }
  const parsed = JSON.parse(text) as { workouts?: unknown[] }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON structure')
  }
  return parsed
}

export function validateAndNormalize(
  rawJson: string,
  startDateISO: string,
  endDateISO: string,
  goal: { distanceKm: number; targetPaceSecPerKm: number; raceDateISO: string },
): ValidatedPlan {
  const parsed = parseAndExtractJson(rawJson)
  const workoutsRaw = Array.isArray(parsed.workouts) ? parsed.workouts : []

  if (workoutsRaw.length === 0) {
    throw new Error('AI returned no workouts')
  }

  const startDate = parseISO(startDateISO)
  const endDate = parseISO(endDateISO)
  if (!isValid(startDate) || !isValid(endDate)) {
    throw new Error('Invalid date range')
  }

  const planId = newId('plan')
  const validated: ValidatedWorkout[] = []

  for (const w of workoutsRaw) {
    if (!w || typeof w !== 'object') continue

    const dateStr = String((w as Record<string, unknown>).dateISO ?? '').trim().slice(0, 10)
    const date = parseISO(dateStr)
    if (!isValid(date) || dateStr.length !== 10) continue
    if (dateStr < startDateISO || dateStr > endDateISO) continue

    const title = String((w as Record<string, unknown>).title ?? 'Workout').trim() || 'Workout'
    const type = normalizeType((w as Record<string, unknown>).type)
    const plannedKm = Number((w as Record<string, unknown>).plannedDistanceKm)
    const plannedDistanceKm = Number.isFinite(plannedKm) && plannedKm > 0 ? Math.round(plannedKm * 10) / 10 : undefined

    const stagesRaw = Array.isArray((w as Record<string, unknown>).stages) ? (w as Record<string, unknown>).stages as unknown[] : []
    const stages: ValidatedStage[] = stagesRaw.map((s) => {
      const ss = s as Record<string, unknown>
      const label = String(ss?.label ?? 'Step').trim() || 'Step'
      const kind = normalizeStageKind(ss?.kind)
      const durationSec = Math.max(0, Math.round(Number(ss?.durationSec) || 60))
      const pace = Number(ss?.targetPaceSecPerKm)
      const targetPaceSecPerKm = Number.isFinite(pace) && pace > 0 ? clampPace(pace) : undefined
      return {
        id: newId('stage'),
        label,
        kind,
        durationSec,
        ...(targetPaceSecPerKm ? { targetPaceSecPerKm } : {}),
      }
    })

    const totalFromStages = stages.reduce((a, st) => a + st.durationSec, 0)
    const totalDurationSec = Math.max(60, totalFromStages || Math.round(Number((w as Record<string, unknown>).totalDurationSec) || 1800))

    validated.push({
      id: newId('workout'),
      dateISO: dateStr,
      title,
      type,
      ...(plannedDistanceKm ? { plannedDistanceKm } : {}),
      stages,
      totalDurationSec,
    })
  }

  validated.sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  if (validated.length === 0) {
    throw new Error('No valid workouts within date range')
  }

  return {
    planId,
    startDateISO,
    endDateISO,
    goal: {
      distanceKm: goal.distanceKm,
      targetPaceSecPerKm: goal.targetPaceSecPerKm,
      raceDateISO: goal.raceDateISO,
      createdAtISO: new Date().toISOString(),
    },
    workouts: validated,
  }
}
