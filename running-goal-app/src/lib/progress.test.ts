import { describe, expect, it } from 'vitest'
import { computeProgress } from './progress'
import type { TrainingPlan, Workout } from './types'

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

function mkPlan(workouts: Workout[], start = '2025-01-01', race = '2025-03-01'): TrainingPlan {
  return {
    version: 1,
    id: 'plan_1',
    generatedAtISO: new Date().toISOString(),
    startDateISO: start,
    raceDateISO: race,
    endDateISO: race,
    goal: {
      distanceKm: 42,
      targetPaceSecPerKm: 300,
      raceDateISO: race,
      createdAtISO: new Date().toISOString(),
    },
    workouts,
  }
}

describe('progress', () => {
  it('computes completion percent', () => {
    const plan = mkPlan([
      mkWorkout({ dateISO: '2025-01-01', completedAtISO: '2025-01-01T10:00:00Z' }),
      mkWorkout({ dateISO: '2025-01-02' }),
    ])
    const p = computeProgress(plan, new Date('2025-01-05'))
    expect(p.completedCount).toBe(1)
    expect(p.totalCount).toBe(2)
    expect(p.completionPct).toBe(50)
  })

  it('computes km to date', () => {
    const plan = mkPlan([
      mkWorkout({
        dateISO: '2025-01-01',
        plannedDistanceKm: 10,
        completedAtISO: '2025-01-01T10:00:00Z',
      }),
      mkWorkout({ dateISO: '2025-01-02', plannedDistanceKm: 5 }),
    ])
    const p = computeProgress(plan, new Date('2025-01-05'))
    expect(p.completedKmToDate).toBe(10)
    expect(p.plannedKmToDate).toBe(15)
  })
})
