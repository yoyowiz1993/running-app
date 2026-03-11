import { computeStreak } from './stats'
import type { TrainingPlan, Workout } from './types'

export type Badge = {
  id: string
  name: string
  description: string
  emoji: string
  earned: boolean
}

export function computeBadges(plan: TrainingPlan | null, workouts: Workout[]): Badge[] {
  const nonRestWorkouts = workouts.filter((w) => w.type !== 'rest')
  const completedWorkouts = nonRestWorkouts.filter((w) => Boolean(w.completedAtISO))
  const completedCount = completedWorkouts.length
  const streak = computeStreak(workouts)
  const totalNonRest = nonRestWorkouts.length
  const planProgress = totalNonRest > 0 ? completedCount / totalNonRest : 0

  const totalCompletedKm = completedWorkouts.reduce(
    (sum, w) => sum + (w.plannedDistanceKm ?? 0),
    0,
  )

  return [
    {
      id: 'first-step',
      name: 'First Step',
      description: 'Complete your first workout',
      emoji: '👟',
      earned: completedCount >= 1,
    },
    {
      id: 'three-streak',
      name: 'On a Roll',
      description: '3-day training streak',
      emoji: '🔥',
      earned: streak >= 3,
    },
    {
      id: 'week-warrior',
      name: 'Week Warrior',
      description: '7-day training streak',
      emoji: '⚡',
      earned: streak >= 7,
    },
    {
      id: 'ten-workouts',
      name: 'Consistent',
      description: 'Complete 10 workouts',
      emoji: '💪',
      earned: completedCount >= 10,
    },
    {
      id: 'halfway',
      name: 'Halfway There',
      description: 'Complete 50% of your plan',
      emoji: '🏃',
      earned: planProgress >= 0.5,
    },
    {
      id: 'distance-50',
      name: 'Road Runner',
      description: 'Log 50 km total',
      emoji: '🛣️',
      earned: totalCompletedKm >= 50,
    },
    {
      id: 'plan-done',
      name: 'Plan Complete',
      description: 'Finish your entire training plan',
      emoji: '🏅',
      earned: plan !== null && planProgress >= 1,
    },
  ]
}
