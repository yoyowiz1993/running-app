export type PushWorkoutStage = {
  label: string
  kind: string
  durationSec: number
  targetPaceSecPerKm?: number
}

export type PushWorkoutInput = {
  workoutId: string
  dateISO: string
  title: string
  type: string
  plannedDistanceKm?: number
  totalDurationSec: number
  stages: PushWorkoutStage[]
}

export type PushResult = {
  workoutId: string
  status: 'queued' | 'synced' | 'failed'
  externalId?: string
  message?: string
}

export function mockPushWorkouts(workouts: PushWorkoutInput[]): PushResult[] {
  return workouts.map((w, idx) => {
    const tooShort = w.totalDurationSec < 120
    if (tooShort) {
      return {
        workoutId: w.workoutId,
        status: 'failed',
        message: 'Workout too short for Garmin sync',
      }
    }
    return {
      workoutId: w.workoutId,
      status: 'synced',
      externalId: `mock_garmin_workout_${idx + 1}_${w.workoutId.slice(0, 8)}`,
      message: 'Synced in mock mode',
    }
  })
}

