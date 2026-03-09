import type { GarminPushResult, GarminPushWorkoutInput } from './garmin'
import type { Workout } from './types'

export function toGarminPushInput(workout: Workout): GarminPushWorkoutInput {
  return {
    workoutId: workout.id,
    dateISO: workout.dateISO,
    title: workout.title,
    type: workout.type,
    plannedDistanceKm: workout.plannedDistanceKm,
    totalDurationSec: workout.totalDurationSec,
    stages: workout.stages.map((s) => ({
      label: s.label,
      kind: s.kind,
      durationSec: s.durationSec,
      targetPaceSecPerKm: s.targetPaceSecPerKm,
    })),
  }
}

export function applyPushResults(workouts: Workout[], results: GarminPushResult[]): Workout[] {
  const byId = new Map(results.map((r) => [r.workoutId, r] as const))
  const now = new Date().toISOString()
  return workouts.map((w) => {
    const r = byId.get(w.id)
    if (!r) return w
    return {
      ...w,
      garminSyncStatus: r.status,
      garminWorkoutId: r.externalId ?? w.garminWorkoutId,
      garminSyncMessage: r.message,
      garminLastSyncedAtISO: now,
    }
  })
}

