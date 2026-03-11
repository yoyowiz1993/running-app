import { addDays, format, getDaysInMonth, isValid, parseISO, startOfMonth } from 'date-fns'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Grid3X3, List, Play, UploadCloud } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { pushWorkoutsToGarmin } from '../lib/garmin'
import { applyPushResults, toGarminPushInput } from '../lib/garminPush'
import { formatPaceWithSpeed } from '../lib/pace'
import {
  loadActivePlan,
  loadPlans,
  savePlan,
  setActivePlanId,
  updateWorkout,
  updateWorkouts,
} from '../lib/storage'
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

function typeDotColor(type: Workout['type']): string {
  switch (type) {
    case 'intervals': return '#8b5cf6'
    case 'tempo': return '#f59e0b'
    case 'long': return '#10b981'
    case 'race': return '#38bdf8'
    case 'easy': return '#34d399'
    default: return 'rgba(255,255,255,0.2)'
  }
}

type MonthDay = {
  day: number | null
  dateISO: string | null
  workout: Workout | null
}

function buildMonthGrid(year: number, month: number, plan: TrainingPlan | null): MonthDay[] {
  const firstDay = startOfMonth(new Date(year, month))
  // Monday-based offset (0=Mon … 6=Sun)
  const rawDow = firstDay.getDay() // 0=Sun
  const offset = rawDow === 0 ? 6 : rawDow - 1
  const daysInMonth = getDaysInMonth(firstDay)

  const cells: MonthDay[] = []

  for (let i = 0; i < offset; i++) {
    cells.push({ day: null, dateISO: null, workout: null })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = format(addDays(firstDay, d - 1), 'yyyy-MM-dd')
    const workout = plan?.workouts.find((w) => w.dateISO === dateISO) ?? null
    cells.push({ day: d, dateISO, workout })
  }

  // Pad to full rows of 7
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateISO: null, workout: null })
  }

  return cells
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function CalendarPage() {
  const nav = useNavigate()
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadActivePlan())
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans())
  const [syncingWorkoutId, setSyncingWorkoutId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')

  const today = new Date()
  const todayISO = format(today, 'yyyy-MM-dd')

  const [gridMonth, setGridMonth] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))

  function switchPlan(planId: string): void {
    setActivePlanId(planId)
    setPlan(loadActivePlan())
    setPlans(loadPlans())
  }

  const groups = useMemo(() => groupByDate(plan?.workouts ?? []), [plan?.workouts])

  const monthGrid = useMemo(
    () => buildMonthGrid(gridMonth.year, gridMonth.month, plan),
    [gridMonth, plan],
  )

  function prevMonth(): void {
    setGridMonth(({ year, month }) => {
      if (month === 0) return { year: year - 1, month: 11 }
      return { year, month: month - 1 }
    })
  }

  function nextMonth(): void {
    setGridMonth(({ year, month }) => {
      if (month === 11) return { year: year + 1, month: 0 }
      return { year, month: month + 1 }
    })
  }

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
            {/* ── Plan header ── */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-base font-semibold text-white">
                      {plan.planName ?? `Race ${plan.goal.distanceKm}km`}
                    </div>
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
                  <div className="mt-1 text-sm text-white/60">
                    {formatPaceWithSpeed(plan.goal.targetPaceSecPerKm)} &middot; {plan.startDateISO} – {plan.raceDateISO}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* View toggle */}
                  <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`rounded-lg p-1.5 transition ${viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`rounded-lg p-1.5 transition ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Button variant="secondary" size="md" onClick={() => void syncAll()} disabled={syncingAll}>
                    <UploadCloud className="h-4 w-4" />
                    {syncingAll ? 'Syncing...' : 'Sync'}
                  </Button>
                </div>
              </div>
            </Card>

            {viewMode === 'grid' ? (
              /* ── Grid view ── */
              <div className="mt-4">
                <Card className="p-4">
                  {/* Month navigator */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={prevMonth}
                      className="rounded-xl p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="text-sm font-semibold text-white">
                      {MONTH_NAMES[gridMonth.month]} {gridMonth.year}
                    </div>
                    <button
                      onClick={nextMonth}
                      className="rounded-xl p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Day labels */}
                  <div className="grid grid-cols-7 mb-1">
                    {DAY_LABELS.map((d, i) => (
                      <div
                        key={i}
                        className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/30 pb-1"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map((cell, i) => {
                      if (!cell.day || !cell.dateISO) {
                        return <div key={i} />
                      }

                      const w = cell.workout
                      const isToday = cell.dateISO === todayISO
                      const hasWorkout = w !== null && w.type !== 'rest'
                      const isDone = Boolean(w?.completedAtISO)
                      const dotColor = w ? typeDotColor(w.type) : null

                      return (
                        <button
                          key={cell.dateISO}
                          onClick={() => {
                            if (hasWorkout && w) nav(`/workout/${w.id}`)
                          }}
                          disabled={!hasWorkout}
                          className={`relative flex flex-col items-center justify-start rounded-xl py-1.5 px-0.5 transition ${
                            isToday
                              ? 'border border-emerald-400/40 bg-emerald-500/10'
                              : hasWorkout
                                ? 'hover:bg-white/10 cursor-pointer'
                                : 'cursor-default'
                          }`}
                        >
                          <span
                            className={`text-xs font-medium ${
                              isToday
                                ? 'text-emerald-400'
                                : hasWorkout
                                  ? 'text-white'
                                  : 'text-white/30'
                            }`}
                          >
                            {cell.day}
                          </span>
                          {hasWorkout && dotColor ? (
                            <div className="mt-0.5 relative">
                              <div
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: dotColor }}
                              />
                              {isDone ? (
                                <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 border border-[#070b14]" />
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-0.5 h-1.5 w-1.5" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
                    {[
                      { type: 'easy' as const, label: 'Easy' },
                      { type: 'long' as const, label: 'Long' },
                      { type: 'tempo' as const, label: 'Tempo' },
                      { type: 'intervals' as const, label: 'Intervals' },
                      { type: 'race' as const, label: 'Race' },
                    ].map(({ type, label }) => (
                      <div key={type} className="flex items-center gap-1">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: typeDotColor(type) }}
                        />
                        <span className="text-[10px] text-white/40">{label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1">
                      <div className="relative h-1.5 w-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-white/30" />
                        <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-[10px] text-white/40 ml-0.5">Done</span>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              /* ── List view ── */
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
                              {typeof w.plannedDistanceKm === 'number' ? (
                                <span>· {w.plannedDistanceKm} km</span>
                              ) : null}
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
                                {syncingWorkoutId === w.id ? 'Syncing...' : 'Send to Garmin'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
