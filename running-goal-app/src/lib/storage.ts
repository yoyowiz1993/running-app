import type { RunningGoal, TrainingPlan, Workout } from './types'
import { supabase } from './supabase'

const KEY_GOAL = 'runningPlan.goal.v1'
const KEY_PLAN = 'runningPlan.plan.v1'
let currentUserId: string | null = null
let syncTimer: number | null = null

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
  scheduleCloudSync()
}

export function loadPlan(): TrainingPlan | null {
  return safeParseJson<TrainingPlan>(localStorage.getItem(KEY_PLAN))
}

export function savePlan(plan: TrainingPlan): void {
  localStorage.setItem(KEY_PLAN, JSON.stringify(plan))
  scheduleCloudSync()
}

export function clearAllData(): void {
  localStorage.removeItem(KEY_GOAL)
  localStorage.removeItem(KEY_PLAN)
  scheduleCloudSync()
}

export function updateWorkout(plan: TrainingPlan, workout: Workout): TrainingPlan {
  return {
    ...plan,
    workouts: plan.workouts.map((w) => (w.id === workout.id ? workout : w)),
  }
}

export function updateWorkouts(plan: TrainingPlan, workouts: Workout[]): TrainingPlan {
  const byId = new Map(workouts.map((w) => [w.id, w] as const))
  return {
    ...plan,
    workouts: plan.workouts.map((w) => byId.get(w.id) ?? w),
  }
}

export function setCloudUserId(userId: string | null): void {
  currentUserId = userId
}

function scheduleCloudSync(): void {
  if (!currentUserId || !supabase) return
  if (syncTimer !== null) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void pushLocalStateToCloud()
  }, 250)
}

async function pushLocalStateToCloud(): Promise<void> {
  if (!currentUserId || !supabase) return
  const goal = loadGoal()
  const plan = loadPlan()
  const { error } = await supabase.from('user_state').upsert(
    {
      user_id: currentUserId,
      goal,
      plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.warn('Cloud sync failed:', error.message)
  }
}

export async function hydrateLocalFromCloud(userId: string): Promise<void> {
  if (!supabase) return
  currentUserId = userId
  const { data, error } = await supabase
    .from('user_state')
    .select('goal,plan')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Cloud hydrate failed:', error.message)
    return
  }

  const localGoal = loadGoal()
  const localPlan = loadPlan()

  // If no cloud row yet, seed cloud from local.
  if (!data) {
    await pushLocalStateToCloud()
    return
  }

  if (data.goal) localStorage.setItem(KEY_GOAL, JSON.stringify(data.goal))
  else if (!localGoal) localStorage.removeItem(KEY_GOAL)

  if (data.plan) localStorage.setItem(KEY_PLAN, JSON.stringify(data.plan))
  else if (!localPlan) localStorage.removeItem(KEY_PLAN)

  // Keep cloud fresh in case local had newer changes not represented yet.
  await pushLocalStateToCloud()
}

