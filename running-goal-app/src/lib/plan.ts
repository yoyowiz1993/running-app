import {
  addDays,
  differenceInCalendarDays,
  formatISO,
  isAfter,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { newId } from './ids'
import { clampPace } from './pace'
import type { RunningGoal, TrainingPlan, Workout, WorkoutStage, WorkoutType } from './types'

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

function sumStages(stages: WorkoutStage[]): number {
  return stages.reduce((acc, s) => acc + s.durationSec, 0)
}

function stage(label: string, kind: WorkoutStage['kind'], durationSec: number, pace?: number): WorkoutStage {
  return {
    id: newId('stage'),
    label,
    kind,
    durationSec: Math.max(0, Math.round(durationSec)),
    ...(pace ? { targetPaceSecPerKm: pace } : null),
  }
}

function workout(params: {
  date: Date
  title: string
  type: WorkoutType
  stages: WorkoutStage[]
  plannedDistanceKm?: number
}): Workout {
  const dateISO = formatISO(startOfDay(params.date), { representation: 'date' })
  const totalDurationSec = sumStages(params.stages)
  return {
    id: newId('workout'),
    dateISO,
    title: params.title,
    type: params.type,
    plannedDistanceKm: params.plannedDistanceKm ? roundTo(params.plannedDistanceKm, 0.1) : undefined,
    stages: params.stages,
    totalDurationSec,
  }
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

  // Recovery week every 4th week (except taper)
  const isTaper = weekIdx >= w - 2
  if (!isTaper && weekIdx > 0 && weekIdx % 4 === 3) vol *= 0.82

  // Taper
  if (weekIdx === w - 2) vol *= 0.72
  if (weekIdx === w - 1) vol *= 0.52

  return Math.max(12, roundTo(vol, 1))
}

export type GeneratePlanOptions = {
  startDate?: Date
  endDate?: Date
  planName?: string
  today?: Date
}

export function generateTrainingPlan(goal: RunningGoal, today = new Date(), options?: GeneratePlanOptions): TrainingPlan {
  const planStart = options?.startDate ? startOfDay(options.startDate) : startOfDay(today)
  const raceDate = parseISO(goal.raceDateISO)
  const explicitEnd = options?.endDate ? startOfDay(options.endDate) : null
  const safeRaceDate =
    explicitEnd ??
    (isValid(raceDate) && isAfter(raceDate, planStart) ? startOfDay(raceDate) : addDays(planStart, 56))

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

  const workouts: Workout[] = []

  for (let weekIdx = 0; weekIdx < weeks; weekIdx++) {
    const weekStart = addDays(week0, weekIdx * 7)
    const volKm = weeklyVolumeKm(weekIdx, weeks, peakWeeklyKm)

    // Distribution across 4 runs/week
    const longKm = Math.max(7, volKm * 0.38)
    const tempoKm = Math.max(5, volKm * 0.22)
    const intervalKm = Math.max(4.5, volKm * 0.18)
    const easyKm = Math.max(4.5, volKm - (longKm + tempoKm + intervalKm))

    // Tue: Intervals
    {
      const date = addDays(weekStart, 1) // Tue
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

      const stages: WorkoutStage[] = [
        stage('Warm up', 'warmup', 10 * 60, easyPace),
        stage('Strides', 'easy', 2 * 60, intervalPace),
      ]
      for (let i = 1; i <= reps; i++) {
        stages.push(stage(`Hard ${i}/${reps}`, 'interval', hardSec, intervalPace))
        stages.push(stage(`Easy ${i}/${reps}`, 'recovery', recSec, recoveryPace))
      }
      stages.push(stage('Cool down', 'cooldown', 10 * 60, easyPace))

      workouts.push(
        workout({
          date,
          title: 'Intervals',
          type: 'intervals',
          stages,
          plannedDistanceKm: intervalKm,
        }),
      )
    }

    // Thu: Tempo
    {
      const date = addDays(weekStart, 3) // Thu
      const phase = weeks === 1 ? 1 : weekIdx / (weeks - 1)
      const tempoMin = Math.round(18 + 20 * Math.min(1, Math.max(0, phase)))
      const stages: WorkoutStage[] = [
        stage('Warm up', 'warmup', 10 * 60, easyPace),
        stage('Tempo', 'tempo', tempoMin * 60, tempoPace),
        stage('Cool down', 'cooldown', 10 * 60, easyPace),
      ]
      workouts.push(
        workout({
          date,
          title: 'Tempo',
          type: 'tempo',
          stages,
          plannedDistanceKm: tempoKm,
        }),
      )
    }

    // Sat: Easy
    {
      const date = addDays(weekStart, 5) // Sat
      const plannedSec = Math.max(25 * 60, easyKm * easyPace)
      const stages: WorkoutStage[] = [
        stage('Warm up', 'warmup', 5 * 60, easyPace),
        stage('Easy run', 'easy', Math.max(10 * 60, plannedSec - 10 * 60), easyPace),
        stage('Cool down', 'cooldown', 5 * 60, easyPace),
      ]
      workouts.push(
        workout({
          date,
          title: 'Easy run',
          type: 'easy',
          stages,
          plannedDistanceKm: easyKm,
        }),
      )
    }

    // Sun: Long
    {
      const date = addDays(weekStart, 6) // Sun
      const plannedSec = Math.max(45 * 60, longKm * longPace)
      const stages: WorkoutStage[] = [
        stage('Warm up', 'warmup', 10 * 60, longPace),
        stage('Long run', 'easy', Math.max(20 * 60, plannedSec - 20 * 60), longPace),
        stage('Cool down', 'cooldown', 10 * 60, longPace),
      ]
      workouts.push(
        workout({
          date,
          title: 'Long run',
          type: 'long',
          stages,
          plannedDistanceKm: longKm,
        }),
      )
    }
  }

  // Race day workout
  {
    const raceSec = Math.max(5 * 60, goal.distanceKm * targetPace)
    const stages: WorkoutStage[] = [
      stage('Warm up', 'warmup', 6 * 60, easyPace),
      stage(`Race (${goal.distanceKm}km)`, 'race', raceSec, targetPace),
      stage('Cool down', 'cooldown', 5 * 60, easyPace),
    ]
    workouts.push(
      workout({
        date: safeRaceDate,
        title: 'Race day',
        type: 'race',
        stages,
        plannedDistanceKm: goal.distanceKm,
      }),
    )
  }

  const planStartStr = formatISO(planStart, { representation: 'date' })
  const planEndStr = formatISO(safeRaceDate, { representation: 'date' })

  const filtered = workouts
    .filter((w) => w.dateISO >= planStartStr && w.dateISO <= planEndStr)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  return {
    version: 1,
    id: newId('plan'),
    generatedAtISO: new Date().toISOString(),
    startDateISO: planStartStr,
    raceDateISO: planEndStr,
    endDateISO: planEndStr,
    planName: options?.planName,
    source: 'local',
    goal,
    workouts: filtered,
  }
}

