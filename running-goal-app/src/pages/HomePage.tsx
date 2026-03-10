import { addDays, format, isAfter, isValid, parseISO, startOfDay } from 'date-fns'
import { CalendarDays, ChevronRight, Flag, Gauge, Link2, List, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Help, Input, Label } from '../components/Field'
import { TopBar } from '../components/TopBar'
import { clampPace, formatPace, parsePaceToSecPerKm } from '../lib/pace'
import { createProgram } from '../lib/programs'
import { computeProgress } from '../lib/progress'
import { fetchGarminActivities } from '../lib/garmin'
import { applyGarminMatches } from '../lib/garminMatching'
import {
  deletePlan,
  loadGoal,
  loadActivePlan,
  loadPlans,
  saveGoal,
  savePlan,
  setActivePlanId,
} from '../lib/storage'
import type { RunningGoal, TrainingPlan, Workout } from '../lib/types'
import { formatDurationShort } from '../lib/time'
import { getGarminAuthUrl } from '../lib/garmin'

function todayISO(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

function nextWorkoutFromPlan(plan: TrainingPlan | null): Workout | null {
  if (!plan) return null
  const t = todayISO()
  return plan.workouts.find((w) => w.dateISO >= t && w.type !== 'rest') ?? null
}

export function HomePage() {
  const nav = useNavigate()
  const [goal, setGoal] = useState<RunningGoal | null>(() => loadGoal())
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadActivePlan())
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans())

  const [distanceKm, setDistanceKm] = useState(() => String(goal?.distanceKm ?? 10))
  const [paceText, setPaceText] = useState(() => (goal ? formatPace(goal.targetPaceSecPerKm) : '5:30'))
  const [raceDate, setRaceDate] = useState(() => goal?.raceDateISO ?? format(addDays(new Date(), 56), 'yyyy-MM-dd'))
  const [planName, setPlanName] = useState(() => `Plan ${format(addDays(new Date(), 56), 'yyyy-MM-dd')}`)
  const [planStartDate, setPlanStartDate] = useState(() => format(startOfDay(new Date()), 'yyyy-MM-dd'))
  const [planEndDate, setPlanEndDate] = useState(() => goal?.raceDateISO ?? format(addDays(new Date(), 56), 'yyyy-MM-dd'))
  const [error, setError] = useState<string | null>(null)
  const [garminConnected] = useState(() => localStorage.getItem('runningPlan.garmin.connected') === 'true')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const nextWorkout = useMemo(() => nextWorkoutFromPlan(plan), [plan])
  const progress = useMemo(() => (plan ? computeProgress(plan, new Date()) : null), [plan])

  async function syncFromGarmin(currentPlan: TrainingPlan | null): Promise<void> {
    if (!currentPlan) return
    const activities = await fetchGarminActivities()
    if (activities.length === 0) return
    const { plan: merged } = applyGarminMatches(currentPlan, activities)
    if (merged !== currentPlan) {
      savePlan(merged)
      setPlan(merged)
    }
  }

  function onSaveGoal(): RunningGoal | null {
    setError(null)
    const d = Number(distanceKm)
    const p = parsePaceToSecPerKm(paceText)
    const rd = parseISO(raceDate)
    if (!Number.isFinite(d) || d <= 0) {
      setError('Please enter a valid distance (km).')
      return null
    }
    if (!p) {
      setError('Please enter pace like 5:30 (min:sec per km).')
      return null
    }
    if (!isValid(rd)) {
      setError('Please pick a race date.')
      return null
    }

    const newGoal: RunningGoal = {
      distanceKm: Math.round(d * 10) / 10,
      targetPaceSecPerKm: clampPace(p),
      raceDateISO: format(startOfDay(rd), 'yyyy-MM-dd'),
      createdAtISO: new Date().toISOString(),
    }
    saveGoal(newGoal)
    setGoal(newGoal)
    return newGoal
  }

  async function onCreatePlan(): Promise<void> {
    setError(null)
    const g = goal ?? onSaveGoal()
    if (!g) return

    const start = parseISO(planStartDate)
    const end = parseISO(planEndDate)
    if (!isValid(start) || !isValid(end)) {
      setError('Please pick valid start and end dates.')
      return
    }
    if (isAfter(start, end)) {
      setError('Plan start must be before plan end.')
      return
    }

    setCreating(true)
    try {
      const { plan: newPlan } = await createProgram({
        goal: { distanceKm: g.distanceKm, targetPaceSecPerKm: g.targetPaceSecPerKm, raceDateISO: g.raceDateISO },
        planName: planName.trim() || undefined,
        startDate: planStartDate,
        endDate: planEndDate,
      })
      savePlan(newPlan)
      setPlan(newPlan)
      setPlans(loadPlans())
      if (garminConnected) {
        void syncFromGarmin(newPlan)
      }
      nav('/calendar')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create program failed')
    } finally {
      setCreating(false)
    }
  }

  function switchPlan(planId: string): void {
    setActivePlanId(planId)
    setPlan(loadActivePlan())
    setPlans(loadPlans())
  }

  function onDeletePlan(p: TrainingPlan): void {
    if (!window.confirm(`Delete "${p.planName ?? `Plan ${p.raceDateISO}`}"? This cannot be undone.`)) return
    setDeletingId(p.id)
    deletePlan(p.id)
    setPlan(loadActivePlan())
    setPlans(loadPlans())
    setDeletingId(null)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Running Plan" />

      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            <div className="text-base font-semibold">Your goal</div>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Flag className="h-4 w-4 text-white/70" /> Distance (km)
                </span>
              </Label>
              <Input
                inputMode="decimal"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="10"
              />
            </div>

            <div>
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-white/70" /> Target pace (min:sec per km)
                </span>
              </Label>
              <Input
                inputMode="numeric"
                value={paceText}
                onChange={(e) => setPaceText(e.target.value)}
                placeholder="5:30"
              />
              <Help>Example: 5:30 means 5 minutes 30 seconds per kilometer.</Help>
            </div>

            <div>
              <Label>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-white/70" /> Race date
                </span>
              </Label>
              <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
            </div>

            <div>
              <Label>Plan name</Label>
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Spring 10k"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Plan start</Label>
                <Input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Plan end</Label>
                <Input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} />
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-1 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={onSaveGoal}>
                Save goal
              </Button>
              <Button className="flex-1" onClick={() => void onCreatePlan()} disabled={creating}>
                <Plus className="h-4 w-4" /> {creating ? 'Creating...' : 'Create program'}
              </Button>
            </div>
          </div>
        </Card>

        {plans.length > 0 ? (
          <Card className="mt-4 p-4">
            <div className="flex items-center gap-2 text-white">
              <List className="h-5 w-5 text-emerald-300" />
              <div className="text-base font-semibold">Your programs</div>
            </div>
            <div className="mt-3 space-y-2">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20"
                >
                  <button
                    type="button"
                    onClick={() => {
                      switchPlan(p.id)
                      nav('/calendar')
                    }}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left transition hover:bg-black/30"
                  >
                    <div className="font-medium text-white">{p.planName ?? `Plan ${p.raceDateISO}`}</div>
                    <div className="text-xs text-white/60">
                      {p.workouts.length} workouts • {p.startDateISO} – {p.raceDateISO}
                      {p.generatedBy === 'ai' ? ' • AI' : p.generatedBy === 'builtin' ? ' • Built-in' : p.source === 'intervals_icu' ? ' • Intervals.icu' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDeletePlan(p)
                    }}
                    disabled={deletingId === p.id}
                    className="shrink-0 rounded-lg p-2 text-white/50 transition hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50"
                    aria-label="Delete program"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchPlan(p.id)
                      nav('/calendar')
                    }}
                    className="shrink-0 rounded-lg p-2 text-white/50 transition hover:bg-white/10"
                    aria-label="Open calendar"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {plan ? (
          <>
            <Card className="mt-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white">Current plan</div>
                    {plans.length > 1 ? (
                      <select
                        value={plan.id}
                        onChange={(e) => switchPlan(e.target.value)}
                        className="rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-emerald-400/50"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.planName ?? `Plan ${p.raceDateISO}`}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    {plan.planName ? `${plan.planName} • ` : ''}
                    {plan.workouts.length} workouts • {plan.startDateISO} – {plan.raceDateISO}
                  </div>
                  {plan.generatedBy ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white/80" style={{ backgroundColor: plan.generatedBy === 'ai' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)' }}>
                      {plan.generatedBy === 'ai' ? (
                        <>AI-generated</>
                      ) : (
                        <>Built-in (AI unavailable)</>
                      )}
                    </div>
                  ) : null}
                  {garminConnected ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Garmin connected
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button variant="ghost" onClick={() => nav('/calendar')}>
                    View
                  </Button>
                  {!garminConnected ? (
                    <button
                      type="button"
                      onClick={() => {
                        getGarminAuthUrl().then((url) => {
                          window.location.href = url
                        })
                      }}
                      className="inline-flex items-center gap-1 text-xs text-emerald-200 underline decoration-emerald-500/60 underline-offset-2"
                    >
                      <Link2 className="h-3 w-3" />
                      Connect Garmin
                    </button>
                  ) : null}
                </div>
              </div>

              {nextWorkout ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-semibold text-white">Next up</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white">{nextWorkout.title}</div>
                      <div className="text-xs text-white/60">
                        {nextWorkout.dateISO} • {formatDurationShort(nextWorkout.totalDurationSec)}
                      </div>
                    </div>
                    <Button size="md" onClick={() => nav(`/workout/${nextWorkout.id}`)}>
                      Start
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {progress ? (
              <Card className="mt-4 p-4">
                <div className="text-base font-semibold text-white">Progress</div>

                <div className="mt-3 grid gap-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Workouts completed</span>
                      <span>
                        {progress.completedCount}/{progress.totalCount} ({progress.completionPct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-violet-500 transition-[width]"
                        style={{ width: `${progress.completionPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Distance so far</span>
                      <span>
                        {progress.completedKmToDate.toFixed(1)}km /{' '}
                        {progress.plannedKmToDate.toFixed(1)}km planned
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width]"
                        style={{
                          width:
                            progress.plannedKmToDate > 0
                              ? `${Math.min(
                                  100,
                                  (progress.completedKmToDate / progress.plannedKmToDate) * 100,
                                )}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Race countdown</span>
                      <span>
                        {progress.raceDaysLeft} days left •{' '}
                        {Math.round(progress.racePct * 100)}% through plan
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-[width]"
                        style={{ width: `${Math.round(progress.racePct * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {progress.weeklyKm.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Last weeks (completed km)
                    </div>
                    <div className="mt-2 flex h-28 items-end gap-3">
                      {progress.weeklyKm.map((w) => {
                        const ratio =
                          progress.maxWeeklyKm > 0 ? w.km / progress.maxWeeklyKm : 0
                        const heightPct = Math.max(0.12, Math.min(1, ratio))
                        return (
                          <div
                            key={w.key}
                            className="flex flex-1 flex-col items-center justify-end gap-1 text-xs text-white/60"
                          >
                            <div className="flex h-20 w-full items-end justify-center rounded-full bg-white/8">
                              <div
                                className="w-7 rounded-full bg-gradient-to-t from-emerald-400 to-violet-500"
                                style={{ height: `${Math.round(heightPct * 100)}%` }}
                              />
                            </div>
                            <div className="text-[10px]">{Math.round(w.km)} km</div>
                            <div className="text-[10px]">{w.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : (
          <Card className="mt-4 p-4">
            <div className="text-base font-semibold text-white">No plan yet</div>
            <div className="mt-1 text-sm text-white/70">
              Save a goal, then tap <span className="font-semibold text-white">Create program</span> to build your training
              calendar.
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

