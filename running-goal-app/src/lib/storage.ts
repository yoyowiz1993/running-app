import type { RunningGoal, TrainingPlan, Workout } from './types'

const KEY_GOAL = 'runningPlan.goal.v1'
const KEY_PLAN = 'runningPlan.plan.v1'

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadGoal(): RunningGoal | null {
  return safeParseJson<RunningGoal>(localStorage.getItem(KEY_GOAL))
}

export function saveGoal(goal: RunningGoal): void {
  localStorage.setItem(KEY_GOAL, JSON.stringify(goal))
}

export function loadPlan(): TrainingPlan | null {
  return safeParseJson<TrainingPlan>(localStorage.getItem(KEY_PLAN))
}

export function savePlan(plan: TrainingPlan): void {
  localStorage.setItem(KEY_PLAN, JSON.stringify(plan))
}

export function clearAllData(): void {
  localStorage.removeItem(KEY_GOAL)
  localStorage.removeItem(KEY_PLAN)
}

export function updateWorkout(plan: TrainingPlan, workout: Workout): TrainingPlan {
  return {
    ...plan,
    workouts: plan.workouts.map((w) => (w.id === workout.id ? workout : w)),
  }
}

