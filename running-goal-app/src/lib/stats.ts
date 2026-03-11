import { addDays, format, startOfDay, startOfWeek, subDays } from 'date-fns'
import type { TrainingPlan, Workout, WorkoutType } from './types'

export type WeekDay = {
  label: string
  dateISO: string
  plannedKm: number
  completedKm: number
  isToday: boolean
  workoutType?: WorkoutType
}

export function computeStreak(workouts: Workout[]): number {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const completedDates = new Set(
    workouts
      .filter((w) => Boolean(w.completedAtISO) && w.type !== 'rest')
      .map((w) => w.dateISO),
  )

  // If today is completed, count from today; otherwise start from yesterday
  const startOffset = completedDates.has(today) ? 0 : 1

  let streak = 0
  for (let i = startOffset; i < 365; i++) {
    const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (completedDates.has(dateStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export function computeCurrentWeek(plan: TrainingPlan, today = new Date()): WeekDay[] {
  const monday = startOfWeek(today, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const dateISO = format(date, 'yyyy-MM-dd')
    const workout = plan.workouts.find((w) => w.dateISO === dateISO)
    return {
      label: format(date, 'EEEEE'), // Single letter: M T W T F S S
      dateISO,
      plannedKm: workout?.plannedDistanceKm ?? 0,
      completedKm:
        workout?.completedAtISO && workout.plannedDistanceKm ? workout.plannedDistanceKm : 0,
      isToday: dateISO === format(startOfDay(today), 'yyyy-MM-dd'),
      workoutType: workout?.type,
    }
  })
}

const COACH_TIPS = [
  'Easy runs should feel conversational. If you can\'t speak in full sentences, slow down.',
  'The 80/20 rule: 80% of your training should be at easy effort, 20% hard.',
  'Sleep is your best recovery tool — aim for 8+ hours the night before a hard session.',
  'Hydration starts 24 hours before your long run, not just that morning.',
  'Consistency beats intensity. A steady 4 runs/week beats sporadic hard weeks.',
  'Warm up before every quality session. 10 minutes easy pace saves your legs.',
  'Running economy improves with strides — 4×20 sec fast at the end of easy runs.',
  'Race day pace feels easy the first half. Resist going out too fast.',
  'Strength training 2x/week reduces injury risk by up to 50% for runners.',
  'Listen to your body. Soreness is normal; sharp pain is not.',
  'Tapering is training too — trust the rest in race week.',
  'Run your long runs 60–90 seconds per km slower than race pace.',
  'Breathe rhythmically — try a 3-step inhale, 2-step exhale pattern.',
  'Cadence of 170–180 steps/min reduces impact and improves efficiency.',
  'Mental toughness: break long workouts into small chunks. One km at a time.',
  'Cross-training on rest days keeps fitness without pounding your joints.',
  'Cold water post-run reduces muscle inflammation better than ice baths for most runners.',
  'Fuel within 30 minutes after hard sessions with protein + carbs for faster recovery.',
  'Intervals build speed, but only if the recovery between reps is long enough.',
  'A 10% weekly mileage increase rule prevents most overuse injuries.',
]

export function getDailyTip(): string {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const dayOfYear = Math.floor((+new Date() - +start) / (1000 * 60 * 60 * 24))
  return COACH_TIPS[dayOfYear % COACH_TIPS.length]
}
