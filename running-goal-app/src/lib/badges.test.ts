import { format, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { computeBadges } from './badges'
import type { Workout } from './types'

function mkWorkout(overrides: Partial<Workout> & { dateISO: string }): Workout {
  const { dateISO, ...rest } = overrides
  return {
    id: `w_${dateISO}`,
    title: 'Run',
    type: 'easy',
    stages: [],
    totalDurationSec: 1800,
    dateISO,
    ...rest,
  } as Workout
}

describe('badges', () => {
  it('awards First Step for one completed workout', () => {
    const workouts = [
      mkWorkout({ dateISO: '2025-01-01', completedAtISO: '2025-01-01T10:00:00Z' }),
    ]
    const badges = computeBadges(null, workouts)
    const first = badges.find((b) => b.id === 'first-step')
    expect(first?.earned).toBe(true)
  })

  it('awards On a Roll for 3-day streak', () => {
    const today = new Date()
    const dates = [2, 1, 0].map((n) => format(subDays(today, n), 'yyyy-MM-dd'))
    const workouts = dates.map((d) =>
      mkWorkout({ dateISO: d, completedAtISO: `${d}T10:00:00Z` }),
    )
    const badges = computeBadges(null, workouts)
    const three = badges.find((b) => b.id === 'three-streak')
    expect(three?.earned).toBe(true)
  })
})
