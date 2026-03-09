export type RunningGoal = {
  distanceKm: number
  targetPaceSecPerKm: number
  raceDateISO: string
  createdAtISO: string
}

export type WorkoutType = 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'rest'

export type WorkoutStageKind =
  | 'warmup'
  | 'easy'
  | 'tempo'
  | 'interval'
  | 'recovery'
  | 'cooldown'
  | 'race'
  | 'rest'

export type WorkoutStage = {
  id: string
  label: string
  kind: WorkoutStageKind
  durationSec: number
  targetPaceSecPerKm?: number
  notes?: string
}

export type Workout = {
  id: string
  dateISO: string
  title: string
  type: WorkoutType
  plannedDistanceKm?: number
  stages: WorkoutStage[]
  totalDurationSec: number
  completedAtISO?: string
  garminActivityId?: string
  garminDistanceKm?: number
  garminDurationSec?: number
  garminAvgPaceSecPerKm?: number
  garminSyncStatus?: 'queued' | 'synced' | 'failed'
  garminWorkoutId?: string
  garminSyncMessage?: string
  garminLastSyncedAtISO?: string
}

export type TrainingPlan = {
  version: 1
  id: string
  generatedAtISO: string
  startDateISO: string
  raceDateISO: string
  goal: RunningGoal
  workouts: Workout[]
}

