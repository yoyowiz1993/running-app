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
  // Garmin fields
  garminActivityId?: string
  garminDistanceKm?: number
  garminDurationSec?: number
  garminAvgPaceSecPerKm?: number
  garminSyncStatus?: 'queued' | 'synced' | 'failed'
  garminWorkoutId?: string
  garminSyncMessage?: string
  garminLastSyncedAtISO?: string
  // Strava fields
  stravaActivityId?: number
  stravaActivityName?: string
  stravaDistanceKm?: number
  stravaMovingSec?: number
  stravaElapsedSec?: number
  stravaAvgPaceSecPerKm?: number
  stravaAvgSpeedKph?: number
  stravaElevationGainM?: number
  stravaAvgHeartRate?: number
  stravaMaxHeartRate?: number
  stravaCalories?: number
  stravaSyncStatus?: 'synced' | 'failed'
  stravaSyncedAtISO?: string
}

export type PlanSource = 'local' | 'intervals_icu'

export type TrainingPlan = {
  version: 1
  id: string
  generatedAtISO: string
  startDateISO: string
  raceDateISO: string
  endDateISO?: string
  planName?: string
  source?: PlanSource
  generatedBy?: 'ai' | 'builtin'
  goal: RunningGoal
  workouts: Workout[]
}

