import { parseISO, startOfDay } from 'date-fns'
import type { GarminActivity } from './garmin'
import type { TrainingPlan, Workout } from './types'

type MatchResult = {
  plan: TrainingPlan
  updatedWorkouts: Workout[]
}

function sameDay(aISO: string, bISO: string): boolean {
  const a = startOfDay(parseISO(aISO))
  const b = startOfDay(parseISO(bISO))
  return a.getTime() === b.getTime()
}

function distanceKmOfWorkout(w: Workout): number {
  return typeof w.plannedDistanceKm === 'number' ? w.plannedDistanceKm : 0
}

export function applyGarminMatches(
  plan: TrainingPlan,
  activities: GarminActivity[],
): MatchResult {
  if (activities.length === 0) {
    return { plan, updatedWorkouts: [] }
  }

  const workouts = [...plan.workouts]
  const updated: Workout[] = []

  for (const activity of activities) {
    const activityDayISO = activity.startTime.slice(0, 10)

    const candidates = workouts.filter(
      (w) =>
        (!w.garminActivityId || w.garminActivityId === activity.id) &&
        sameDay(w.dateISO, activityDayISO) &&
        w.type !== 'rest',
    )

    if (candidates.length === 0) continue

    const scored = candidates
      .map((w) => {
        const plannedKm = distanceKmOfWorkout(w)
        const distDiff = Math.abs(activity.distanceKm - plannedKm)
        const durationDiff = Math.abs(activity.durationSec - w.totalDurationSec)
        return {
          workout: w,
          score: distDiff * 0.7 + durationDiff / 600,
        }
      })
      .sort((a, b) => a.score - b.score)

    const best = scored[0]
    if (!best) continue

    const plannedKm = distanceKmOfWorkout(best.workout)
    const distRatio = plannedKm > 0 ? activity.distanceKm / plannedKm : 1
    if (distRatio < 0.6 || distRatio > 1.5) continue

    const idx = workouts.findIndex((w) => w.id === best.workout.id)
    if (idx === -1) continue

    const merged: Workout = {
      ...workouts[idx],
      completedAtISO: workouts[idx].completedAtISO ?? activity.startTime,
      garminActivityId: activity.id,
      garminDistanceKm: activity.distanceKm,
      garminDurationSec: activity.durationSec,
      garminAvgPaceSecPerKm: activity.avgPaceSecPerKm,
    }
    workouts[idx] = merged
    updated.push(merged)
  }

  if (updated.length === 0) {
    return { plan, updatedWorkouts: [] }
  }

  return {
    plan: {
      ...plan,
      workouts,
    },
    updatedWorkouts: updated,
  }
}

