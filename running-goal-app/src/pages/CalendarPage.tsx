import { format, isValid, parseISO } from 'date-fns'
import { CheckCircle2, Clock, Play, UploadCloud } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { pushWorkoutsToGarmin } from '../lib/garmin'
import { applyPushResults, toGarminPushInput } from '../lib/garminPush'
import { formatPace } from '../lib/pace'
import { loadPlan, savePlan, updateWorkout, updateWorkouts } from '../lib/storage'
import type { TrainingPlan, Workout } from '../lib/types'
import { formatDurationShort } from '../lib/time'

function fmtDate(dateISO: string): string {
  const d = parseISO(dateISO)
  if (!isValid(d)) return dateISO
  return format(d, 'EEE, MMM d')
}

function groupByDate(workouts: Workout[]): Array<{ dateISO: string; items: Workout[] }> {
  const map = new Map<string, Workout[]>()
  for (const w of workouts) {
    const arr = map.get(w.dateISO) ?? []
    arr.push(w)
    map.set(w.dateISO, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateISO, items]) => ({ dateISO, items }))
}

function typeBadge(type: Workout['type']): string {
  switch (type) {
    case 'intervals':
      return 'bg-violet-500/15 text-violet-100 border-violet-400/30'
    case 'tempo':
      return 'bg-amber-500/15 text-amber-100 border-amber-400/30'
    case 'long':
      return 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30'
    case 'race':
      return 'bg-sky-500/15 text-sky-100 border-sky-400/30'
    default:
      return 'bg-white/10 text-white/80 border-white/15'
  }
}

export function CalendarPage() {
  const nav = useNavigate()
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadPlan())
  const [syncingWorkoutId, setSyncingWorkoutId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  const groups = useMemo(() => groupByDate(plan?.workouts ?? []), [plan?.workouts])

  function toggleComplete(w: Workout): void {
    if (!plan) return
    const updated: Workout = {
      ...w,
      completedAtISO: w.completedAtISO ? undefined : new Date().toISOString(),
    }
    const nextPlan = updateWorkout(plan, updated)
    savePlan(nextPlan)
    setPlan(nextPlan)
  }

  async function syncOne(w: Workout): Promise<void> {
    if (!plan || w.type === 'rest') return
    setSyncingWorkoutId(w.id)
    const results = await pushWorkoutsToGarmin([toGarminPushInput(w)])
    const patched = applyPushResults([w], results)
    const nextPlan = updateWorkouts(plan, patched)
    savePlan(nextPlan)
    setPlan(nextPlan)
    setSyncingWorkoutId(null)
  }

  async function syncAll(): Promise<void> {
    if (!plan) return
    const targets = plan.workouts.filter((w) => w.type !== 'rest')
    if (targets.length === 0) return
    setSyncingAll(true)
    const results = await pushWorkoutsToGarmin(targets.map(toGarminPushInput))
    const patched = applyPushResults(targets, results)
    const nextPlan = updateWorkouts(plan, patched)
    savePlan(nextPlan)
    setPlan(nextPlan)
    setSyncingAll(false)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Calendar" />
      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
        {!plan ? (
          <Card className="p-4">
            <div className="text-base font-semibold text-white">No plan found</div>
            <div className="mt-1 text-sm text-white/70">Go to Home and create a training plan.</div>
            <div className="mt-3">
              <Button onClick={() => nav('/')}>Go to Home</Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">Race {plan.goal.distanceKm}km</div>
                  <div className="mt-1 text-sm text-white/70">
                    Target pace {formatPace(plan.goal.targetPaceSecPerKm)} • race {plan.raceDateISO}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => void syncAll()} disabled={syncingAll}>
                  <UploadCloud className="h-4 w-4" /> {syncingAll ? 'Sending...' : 'Send All'}
                </Button>
              </div>
            </Card>

            <div className="mt-4 grid gap-3">
              {groups.map(({ dateISO, items }) => (
                <div key={dateISO} className="grid gap-2">
                  <div className="px-1 text-xs font-semibold uppercase tracking-wide text-white/50">
                    {fmtDate(dateISO)}
                  </div>
                  {items.map((w) => (
                    <Card key={w.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${typeBadge(w.type)}`}
                            >
                              {w.type}
                            </div>
                            {w.completedAtISO ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
                                <CheckCircle2 className="h-4 w-4" /> done
                              </span>
                            ) : null}
                            {w.garminSyncStatus ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                  w.garminSyncStatus === 'synced'
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                    : w.garminSyncStatus === 'failed'
                                      ? 'border-red-400/30 bg-red-500/10 text-red-200'
                                      : 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                                }`}
                              >
                                Garmin {w.garminSyncStatus}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-white">{w.title}</div>
                          <div className="mt-1 inline-flex items-center gap-2 text-xs text-white/60">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-4 w-4" /> {formatDurationShort(w.totalDurationSec)}
                            </span>
                            {typeof w.plannedDistanceKm === 'number' ? <span>• {w.plannedDistanceKm}km</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          {w.type !== 'rest' ? (
                            <Button size="md" onClick={() => nav(`/workout/${w.id}`)}>
                              <Play className="h-4 w-4" /> Start
                            </Button>
                          ) : null}
                          <Button variant="ghost" onClick={() => toggleComplete(w)}>
                            {w.completedAtISO ? 'Undo' : 'Mark done'}
                          </Button>
                          {w.type !== 'rest' ? (
                            <Button
                              variant="ghost"
                              onClick={() => void syncOne(w)}
                              disabled={syncingWorkoutId === w.id || syncingAll}
                            >
                              {syncingWorkoutId === w.id ? 'Sending...' : 'Send to Garmin'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

