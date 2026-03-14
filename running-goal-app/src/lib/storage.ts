import type { RunningGoal, TrainingPlan, Workout } from './types'
import type { NutritionGoals } from './nutrition'
import { saveNutritionGoals } from './nutrition'
import { supabase } from './supabase'
import { setSyncStatus } from './syncStatus'
import { showToast } from './toast'

const KEY_GOAL = 'runningPlan.goal.v1'
const KEY_PLAN = 'runningPlan.plan.v1'
const KEY_PLANS = 'runningPlan.plans.v2'
const KEY_ACTIVE_PLAN_ID = 'runningPlan.activePlanId.v2'
const KEY_ONBOARDING = 'runningPlan.onboardingComplete.v1'
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

function migrateLegacyPlanIfNeeded(): void {
  const legacy = localStorage.getItem(KEY_PLAN)
  const plans = localStorage.getItem(KEY_PLANS)
  if (!legacy || plans) return

  const parsed = safeParseJson<TrainingPlan>(legacy)
  if (!parsed) {
    localStorage.removeItem(KEY_PLAN)
    return
  }

  const migrated = { ...parsed, planName: parsed.planName ?? `Plan ${parsed.raceDateISO}`, endDateISO: parsed.endDateISO ?? parsed.raceDateISO }
  localStorage.setItem(KEY_PLANS, JSON.stringify([migrated]))
  localStorage.setItem(KEY_ACTIVE_PLAN_ID, migrated.id)
  localStorage.removeItem(KEY_PLAN)
}

export function loadGoal(): RunningGoal | null {
  return safeParseJson<RunningGoal>(localStorage.getItem(KEY_GOAL))
}

export function saveGoal(goal: RunningGoal): void {
  localStorage.setItem(KEY_GOAL, JSON.stringify(goal))
  scheduleCloudSync()
}

export function loadPlans(): TrainingPlan[] {
  migrateLegacyPlanIfNeeded()
  const raw = localStorage.getItem(KEY_PLANS)
  if (!raw) return []
  const arr = safeParseJson<TrainingPlan[]>(raw)
  return Array.isArray(arr) ? arr : []
}

export function savePlans(plans: TrainingPlan[]): void {
  localStorage.setItem(KEY_PLANS, JSON.stringify(plans))
  scheduleCloudSync()
}

export function loadActivePlanId(): string | null {
  migrateLegacyPlanIfNeeded()
  return localStorage.getItem(KEY_ACTIVE_PLAN_ID)
}

export function setActivePlanId(id: string | null): void {
  if (id) localStorage.setItem(KEY_ACTIVE_PLAN_ID, id)
  else localStorage.removeItem(KEY_ACTIVE_PLAN_ID)
  scheduleCloudSync()
}

export function loadActivePlan(): TrainingPlan | null {
  const plans = loadPlans()
  const activeId = loadActivePlanId()
  if (!activeId) return plans[0] ?? null
  const found = plans.find((p) => p.id === activeId)
  return found ?? plans[0] ?? null
}

export function loadPlan(): TrainingPlan | null {
  return loadActivePlan()
}

export function savePlan(plan: TrainingPlan): void {
  const plans = loadPlans()
  const idx = plans.findIndex((p) => p.id === plan.id)
  const next = idx >= 0 ? plans.map((p, i) => (i === idx ? plan : p)) : [...plans, plan]
  savePlans(next)
  setActivePlanId(plan.id)
}

export function deletePlan(planId: string): void {
  const plans = loadPlans().filter((p) => p.id !== planId)
  const activeId = loadActivePlanId()
  savePlans(plans)
  if (activeId === planId) {
    setActivePlanId(plans[0]?.id ?? null)
  } else {
    setActivePlanId(activeId)
  }
}

function clearLocalKeys(): void {
  localStorage.removeItem(KEY_GOAL)
  localStorage.removeItem(KEY_PLAN)
  localStorage.removeItem(KEY_PLANS)
  localStorage.removeItem(KEY_ACTIVE_PLAN_ID)
  // Clear nutrition goals too so they don't bleed between users
  localStorage.removeItem('nutrition.goals')
  // Clear session suggestions
  sessionStorage.removeItem('nutrition.suggestions.session')
  localStorage.removeItem(KEY_ONBOARDING)
}

export function loadOnboardingComplete(): boolean {
  return localStorage.getItem(KEY_ONBOARDING) === 'true'
}

export function setOnboardingComplete(): void {
  localStorage.setItem(KEY_ONBOARDING, 'true')
  scheduleCloudSync()
}

export function clearAllData(): void {
  clearLocalKeys()
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
  if (!userId) setSyncStatus('idle')
}

/** Retry cloud sync after a failure. Call from Settings or sync-failed UI. */
export async function retryCloudSync(): Promise<void> {
  if (!currentUserId || !supabase) return
  setSyncStatus('syncing')
  await pushLocalStateToCloud()
}

function scheduleCloudSync(): void {
  if (!currentUserId || !supabase) return
  if (syncTimer !== null) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = null
    void pushLocalStateToCloud()
  }, 250)
}

/** Push current local state to cloud immediately. Used before sign-out so plans are saved before we clear. */
export async function flushCloudSync(): Promise<void> {
  if (syncTimer !== null) {
    window.clearTimeout(syncTimer)
    syncTimer = null
  }
  if (currentUserId && supabase) {
    await pushLocalStateToCloud()
  }
}

async function pushLocalStateToCloud(): Promise<void> {
  if (!currentUserId || !supabase) return
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
  if (isOffline) {
    setSyncStatus('offline')
    return
  }

  setSyncStatus('syncing')
  const goal = loadGoal()
  const plans = loadPlans()
  const activePlanId = loadActivePlanId()
  const plan = loadActivePlan()

  // Core columns (base schema + multi-plan). Omit onboarding_complete and nutrition_goals
  // so sync works even when those migrations haven't been run (avoids "column not found" error).
  const payload: Record<string, unknown> = {
    user_id: currentUserId,
    goal,
    plan,
    updated_at: new Date().toISOString(),
  }
  if (plans.length > 0) payload.plans = plans
  if (activePlanId) payload.active_plan_id = activePlanId

  const { error } = await supabase.from('user_state').upsert(payload as Record<string, unknown>, { onConflict: 'user_id' })
  if (error) {
    setSyncStatus('failed', error.message)
    showToast(`Sync failed: ${error.message}`, 'error')
    return
  }
  setSyncStatus('synced')
}

export async function hydrateLocalFromCloud(userId: string): Promise<void> {
  if (!supabase) return
  currentUserId = userId

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
  if (isOffline) {
    setSyncStatus('offline')
    return // Keep local state when offline
  }

  setSyncStatus('syncing')
  const { data, error } = await supabase
    .from('user_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    setSyncStatus('failed', error.message)
    showToast(`Could not load cloud data: ${error.message}`, 'error')
    return // Do not clear — keep existing local state
  }
  setSyncStatus('synced')

  // Now safe to clear and restore (prevents data from previous user bleeding through)
  clearLocalKeys()

  if (!data) {
    return // Brand-new user, localStorage already cleared
  }

  if (data.onboarding_complete === true) {
    localStorage.setItem(KEY_ONBOARDING, 'true')
  }

  if (data.goal) localStorage.setItem(KEY_GOAL, JSON.stringify(data.goal))

  if (data.nutrition_goals && typeof data.nutrition_goals === 'object') {
    saveNutritionGoals(data.nutrition_goals as NutritionGoals)
  }

  const cloudPlans = Array.isArray(data.plans) ? (data.plans as TrainingPlan[]) : null
  const cloudActiveId = typeof data.active_plan_id === 'string' ? data.active_plan_id : null

  if (cloudPlans && cloudPlans.length > 0) {
    localStorage.setItem(KEY_PLANS, JSON.stringify(cloudPlans))
    if (cloudActiveId) localStorage.setItem(KEY_ACTIVE_PLAN_ID, cloudActiveId)
    else if (cloudPlans[0]) localStorage.setItem(KEY_ACTIVE_PLAN_ID, cloudPlans[0].id)
    localStorage.removeItem(KEY_PLAN)
  } else if (data.plan && typeof data.plan === 'object') {
    const legacy = data.plan as TrainingPlan
    const migrated = {
      ...legacy,
      planName: legacy.planName ?? `Plan ${legacy.raceDateISO}`,
      endDateISO: legacy.endDateISO ?? legacy.raceDateISO,
    }
    localStorage.setItem(KEY_PLANS, JSON.stringify([migrated]))
    localStorage.setItem(KEY_ACTIVE_PLAN_ID, migrated.id)
    localStorage.removeItem(KEY_PLAN)
  }
}
