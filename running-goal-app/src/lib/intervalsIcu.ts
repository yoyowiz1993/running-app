import { getApiBase } from './garmin'
import type { TrainingPlan } from './types'

const STORAGE_KEY = 'runningPlan.intervalsApiKey'

export function getStoredIntervalsApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function setStoredIntervalsApiKey(key: string): void {
  if (key) localStorage.setItem(STORAGE_KEY, key)
  else localStorage.removeItem(STORAGE_KEY)
}

export async function importFromIntervalsIcu(params: {
  apiKey: string
  oldest: string
  newest: string
  planName?: string
}): Promise<{ plan: TrainingPlan; eventsCount: number }> {
  const base = await getApiBase()
  const res = await fetch(`${base}/api/intervals/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: params.apiKey.trim(),
      oldest: params.oldest,
      newest: params.newest,
      planName: params.planName?.trim() || undefined,
    }),
    credentials: 'omit',
    mode: 'cors',
  })
  const data = (await res.json()) as { plan?: TrainingPlan; eventsCount?: number; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Import failed (${res.status})`)
  }
  if (!data.plan) throw new Error(data.error ?? 'No plan returned')
  return { plan: data.plan, eventsCount: data.eventsCount ?? 0 }
}
