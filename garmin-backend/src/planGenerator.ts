/**
 * Server-side plan generation (mirrors frontend plan.ts logic).
 * Used by POST /api/programs/create to build workouts before pushing to Intervals.
 */

import { addDays, differenceInCalendarDays, formatISO, startOfDay, startOfWeek } from 'date-fns'

export type GoalInput = {
  distanceKm: number
  targetPaceSecPerKm: number
  raceDateISO: string
}

export type GeneratedGoal = GoalInput & { createdAtISO: string }

export type GeneratedWorkout = {
  id: string
  dateISO: string
  title: string
  type: 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'rest'
  plannedDistanceKm?: number
  totalDurationSec: number
  stages: Array<{ id: string; label: string; kind: string; durationSec: number; targetPaceSecPerKm?: number }>
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

function clampPace(secPerKm: number): number {
  return Math.min(Math.max(secPerKm, 120), 720)
}

function computePeakWeeklyKm(distanceKm: number): number {
  const d = Math.max(1, distanceKm)
  const mult = d >= 42 ? 3.2 : d >= 21 ? 3.0 : d >= 10 ? 2.8 : 2.5
  const peak = d * mult
  return Math.min(Math.max(peak, 18), 85)
}

function weeklyVolumeKm(weekIdx: number, weeks: number, peakKm: number): number {
  const w = Math.max(4, weeks)
  const t = w === 1 ? 1 : weekIdx / (w - 1)
  let vol = peakKm * (0.62 + 0.48 * t)
  vol = Math.min(vol, peakKm)
  const isTaper = weekIdx >= w - 2
  if (!isTaper && weekIdx > 0 && weekIdx % 4 === 3) vol *= 0.82
  if (weekIdx === w - 2) vol *= 0.72
  if (weekIdx === w - 1) vol *= 0.52
  return Math.max(12, roundTo(vol, 1))
}

export function generatePlan(
  goal: GoalInput,
  startDate: Date,
  endDate: Date,
  planName?: string,
): { planId: string; startDateISO: string; endDateISO: string; planName?: string; goal: GeneratedGoal; workouts: GeneratedWorkout[] } {
  const planStart = startOfDay(startDate)
  const safeRaceDate = startOfDay(endDate)
  const daysToRace = Math.max(14, differenceInCalendarDays(safeRaceDate, planStart))
  const weeks = Math.max(4, Math.min(26, Math.ceil(daysToRace / 7)))

  const targetPace = clampPace(goal.targetPaceSecPerKm)
  const easyPace = clampPace(targetPace + 75)
  const longPace = clampPace(targetPace + 95)
  const tempoPace = clampPace(targetPace + 15)
  const intervalPace = clampPace(Math.max(120, targetPace - 25))
  const recoveryPace = clampPace(easyPace + 10)

  const week0 = startOfWeek(planStart, { weekStartsOn: 1 })
  const peakWeeklyKm = computePeakWeeklyKm(goal.distanceKm)

  const workouts: GeneratedWorkout[] = []

  function stage(label: string, kind: string, durationSec: number, pace?: number) {
    return {
      id: newId('stage'),
      label,
      kind,
      durationSec: Math.max(0, Math.round(durationSec)),
      ...(pace ? { targetPaceSecPerKm: pace } : {}),
    }
  }

  function wkt(params: { date: Date; title: string; type: GeneratedWorkout['type']; stages: ReturnType<typeof stage>[]; plannedDistanceKm?: number }): GeneratedWorkout {
    const dateISO = formatISO(startOfDay(params.date), { representation: 'date' })
    const totalDurationSec = params.stages.reduce((a, s) => a + s.durationSec, 0)
    const base: GeneratedWorkout = {
      id: newId('workout'),
      dateISO,
      title: params.title,
      type: params.type,
      stages: params.stages,
      totalDurationSec,
    }
    if (params.plannedDistanceKm != null) {
      base.plannedDistanceKm = roundTo(params.plannedDistanceKm, 0.1)
    }
    return base
  }

  for (let weekIdx = 0; weekIdx < weeks; weekIdx++) {
    const weekStart = addDays(week0, weekIdx * 7)
    const volKm = weeklyVolumeKm(weekIdx, weeks, peakWeeklyKm)
    const longKm = Math.max(7, volKm * 0.38)
    const tempoKm = Math.max(5, volKm * 0.22)
    const intervalKm = Math.max(4.5, volKm * 0.18)
    const easyKm = Math.max(4.5, volKm - (longKm + tempoKm + intervalKm))

    const phase = weeks === 1 ? 1 : weekIdx / (weeks - 1)
    const recoveryWeek = weekIdx > 0 && weekIdx % 4 === 3 && weekIdx < weeks - 2
    let hardSec = 60
    let recSec = 60
    let reps = 8
    if (phase >= 0.35 && phase < 0.7) {
      hardSec = 120
      recSec = 75
      reps = 6
    } else if (phase >= 0.7) {
      hardSec = 180
      recSec = 90
      reps = 5
    }
    if (recoveryWeek) reps = Math.max(4, reps - 2)

    const intervalStages = [
      stage('Warm up', 'warmup', 10 * 60, easyPace),
      stage('Strides', 'easy', 2 * 60, intervalPace),
    ]
    for (let i = 1; i <= reps; i++) {
      intervalStages.push(stage(`Hard ${i}/${reps}`, 'interval', hardSec, intervalPace))
      intervalStages.push(stage(`Easy ${i}/${reps}`, 'recovery', recSec, recoveryPace))
    }
    intervalStages.push(stage('Cool down', 'cooldown', 10 * 60, easyPace))

    workouts.push(
      wkt({
        date: addDays(weekStart, 1),
        title: 'Intervals',
        type: 'intervals',
        stages: intervalStages,
        plannedDistanceKm: intervalKm,
      }),
    )

    const tempoMin = Math.round(18 + 20 * Math.min(1, Math.max(0, phase)))
    workouts.push(
      wkt({
        date: addDays(weekStart, 3),
        title: 'Tempo',
        type: 'tempo',
        stages: [
          stage('Warm up', 'warmup', 10 * 60, easyPace),
          stage('Tempo', 'tempo', tempoMin * 60, tempoPace),
          stage('Cool down', 'cooldown', 10 * 60, easyPace),
        ],
        plannedDistanceKm: tempoKm,
      }),
    )

    const plannedEasySec = Math.max(25 * 60, easyKm * easyPace)
    workouts.push(
      wkt({
        date: addDays(weekStart, 5),
        title: 'Easy run',
        type: 'easy',
        stages: [
          stage('Warm up', 'warmup', 5 * 60, easyPace),
          stage('Easy run', 'easy', Math.max(10 * 60, plannedEasySec - 10 * 60), easyPace),
          stage('Cool down', 'cooldown', 5 * 60, easyPace),
        ],
        plannedDistanceKm: easyKm,
      }),
    )

    const plannedLongSec = Math.max(45 * 60, longKm * longPace)
    workouts.push(
      wkt({
        date: addDays(weekStart, 6),
        title: 'Long run',
        type: 'long',
        stages: [
          stage('Warm up', 'warmup', 10 * 60, longPace),
          stage('Long run', 'easy', Math.max(20 * 60, plannedLongSec - 20 * 60), longPace),
          stage('Cool down', 'cooldown', 10 * 60, longPace),
        ],
        plannedDistanceKm: longKm,
      }),
    )
  }

  const raceSec = Math.max(5 * 60, goal.distanceKm * targetPace)
  workouts.push(
    wkt({
      date: safeRaceDate,
      title: 'Race day',
      type: 'race',
      stages: [
        stage('Warm up', 'warmup', 6 * 60, easyPace),
        stage(`Race (${goal.distanceKm}km)`, 'race', raceSec, targetPace),
        stage('Cool down', 'cooldown', 5 * 60, easyPace),
      ],
      plannedDistanceKm: goal.distanceKm,
    }),
  )

  const planStartStr = formatISO(planStart, { representation: 'date' })
  const planEndStr = formatISO(safeRaceDate, { representation: 'date' })

  const filtered = workouts
    .filter((w) => w.dateISO >= planStartStr && w.dateISO <= planEndStr)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  const planId = newId('plan')
  const result: { planId: string; startDateISO: string; endDateISO: string; planName?: string; goal: GeneratedGoal; workouts: GeneratedWorkout[] } = {
    planId,
    startDateISO: planStartStr,
    endDateISO: planEndStr,
    goal: {
      distanceKm: goal.distanceKm,
      targetPaceSecPerKm: goal.targetPaceSecPerKm,
      raceDateISO: goal.raceDateISO,
      createdAtISO: new Date().toISOString(),
    },
    workouts: filtered,
  }
  if (planName != null) result.planName = planName
  return result
}
