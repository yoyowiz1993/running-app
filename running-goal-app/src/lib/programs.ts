import { getApiBase } from './garmin'
import type { TrainingPlan } from './types'

export type CreateProgramInput = {
  goal: { distanceKm: number; targetPaceSecPerKm: number; raceDateISO: string }
  planName?: string
  startDate: string
  endDate: string
}

export async function createProgram(input: CreateProgramInput): Promise<{ plan: TrainingPlan }> {
  const base = await getApiBase()
  const res = await fetch(`${base}/api/programs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: input.goal,
      planName: input.planName?.trim() || undefined,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
    credentials: 'omit',
    mode: 'cors',
  })
  const data = (await res.json()) as { plan?: TrainingPlan; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Create program failed (${res.status})`)
  }
  if (!data.plan) throw new Error(data.error ?? 'No plan returned')
  return { plan: data.plan }
}

