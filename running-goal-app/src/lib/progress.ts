import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import type { TrainingPlan, Workout } from './types'

export type PlanProgress = {
  completedCount: number
  totalCount: number
  completionPct: number
  completedKmToDate: number
  plannedKmToDate: number
  raceDaysLeft: number
  raceTotalDays: number
  racePct: number
  weeklyKm: Array<{ key: string; label: string; km: number }>
  maxWeeklyKm: number
}

function kmOf(w: Workout): number {
  return typeof w.plannedDistanceKm === 'number' ? w.plannedDistanceKm : 0
}

export function computeProgress(plan: TrainingPlan, today = new Date()): PlanProgress {
  const now = startOfDay(today)
  const raceDate = startOfDay(parseISO(plan.raceDateISO))
  const startDate = startOfDay(parseISO(plan.startDateISO))

  const totalCount = plan.workouts.length
  const completed = plan.workouts.filter((w) => Boolean(w.completedAtISO))
  const completedCount = completed.length
  const completionPct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  let completedKmToDate = 0
  let plannedKmToDate = 0

  const weeklyMap = new Map<string, number>()

  for (const w of plan.workouts) {
    const d = parseISO(w.dateISO)
    if (!isValid(d)) continue
    const day = startOfDay(d)
    const km = kmOf(w)

    if (day <= now) {
      plannedKmToDate += km
      if (w.completedAtISO) completedKmToDate += km
    }

    if (w.completedAtISO) {
      const wk = startOfWeek(day, { weekStartsOn: 1 })
      const key = format(wk, 'yyyy-MM-dd')
      weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + km)
    }
  }

  // Race progress based on calendar days
  const totalDays = Math.max(1, differenceInCalendarDays(raceDate, startDate))
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, differenceInCalendarDays(now, startDate)),
  )
  const raceDaysLeft = Math.max(0, differenceInCalendarDays(raceDate, now))
  const racePct = Math.min(1, Math.max(0, elapsedDays / totalDays))

  const weeklyKmAll = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, km]) => ({
      key,
      label: format(parseISO(key), 'MMM d'),
      km,
    }))

  const weeklyKm =
    weeklyKmAll.length > 0 ? weeklyKmAll.slice(-6) : []

  const maxWeeklyKm =
    weeklyKm.length > 0 ? weeklyKm.reduce((m, w) => Math.max(m, w.km), 0) : 0

  return {
    completedCount,
    totalCount,
    completionPct,
    completedKmToDate,
    plannedKmToDate,
    raceDaysLeft,
    raceTotalDays: totalDays,
    racePct,
    weeklyKm,
    maxWeeklyKm,
  }
}

