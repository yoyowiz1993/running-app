import { addDays, format, getDaysInMonth, isValid, parseISO, startOfMonth } from 'date-fns'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Grid3X3, List, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { pushWorkoutsToGarmin } from '../lib/garmin'
import { applyPushResults, toGarminPushInput } from '../lib/garminPush'
import { fetchStravaActivities, matchActivitiesToWorkouts, applyStravaMatchesToWorkouts } from '../lib/strava'
import { formatPaceWithSpeed } from '../lib/pace'
import {
  flushCloudSync,
  loadActivePlan,
  loadPlans,
  savePlan,
  setActivePlanId,
  updateWorkout,
  updateWorkouts,
} from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { TrainingPlan, Workout } from '../lib/types'
import { formatDurationShort } from '../lib/time'

// ── Brand buttons ──────────────────────────────────────────────────────────
function StravaButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl border border-[#FC4C02]/30 bg-[#FC4C02]/15 px-3 py-1.5 text-xs font-semibold text-[#FC4C02] transition hover:bg-[#FC4C02]/25 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>
      {loading ? 'Syncing…' : (label ?? 'Strava')}
    </button>
  )
}

function GarminButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl border border-[#1F6DAA]/30 bg-[#1F6DAA]/15 px-3 py-1.5 text-xs font-semibold text-[#5BA3D0] transition hover:bg-[#1F6DAA]/25 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zm0 3a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
      </svg>
      {loading ? 'Syncing…' : (label ?? 'Garmin')}
    </button>
  )
}

// ── Workout status ─────────────────────────────────────────────────────────
function getWorkoutStatus(w: Workout, todayISO: string): 'completed' | 'missed' | 'pending' {
  if (w.completedAtISO) return 'completed'
  if (w.missedAtISO) return 'missed'
  if (w.type === 'rest') return 'completed'
  if (w.dateISO < todayISO) return 'missed'
  return 'pending'
}

function StatusBadge({ status }: { status: 'completed' | 'missed' | 'pending' }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> Done
    </span>
  )
  if (status === 'missed') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
      ✕ Missed
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40">
      · Pending
    </span>
  )
}

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
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingStrava, setSyncingStrava] = useState(false)
  const [stravaMessage, setStravaMessage] = useState<string>('')
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

  async function toggleComplete(w: Workout): Promise<void> {
    if (!plan) return
    const updated: Workout = {
      ...w,
      completedAtISO: w.completedAtISO ? undefined : new Date().toISOString(),
    }
    const nextPlan = updateWorkout(plan, updated)
    savePlan(nextPlan)
    await flushCloudSync()
    setPlan(nextPlan)
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
    await flushCloudSync()
    setPlan(nextPlan)
    setSyncingAll(false)
  }

  async function syncFromStrava(): Promise<void> {
    if (!plan) return
    setSyncingStrava(true)
    setStravaMessage('')
    try {
      const { data } = await supabase!.auth.getUser()
      const userId = data.user?.id
      if (!userId) throw new Error('Not signed in')
      const activities = await fetchStravaActivities(userId)
      const matches = matchActivitiesToWorkouts(plan.workouts, activities)
      if (matches.size === 0) {
        setStravaMessage('No matching Strava activities found for this plan.')
        setSyncingStrava(false)
        return
      }
      const updatedWorkouts = applyStravaMatchesToWorkouts(plan.workouts, matches)
      const nextPlan = updateWorkouts(plan, updatedWorkouts)
      savePlan(nextPlan)
      await flushCloudSync()
      setPlan(nextPlan)
      setStravaMessage(`Synced ${matches.size} workout${matches.size !== 1 ? 's' : ''} from Strava.`)
    } catch (err) {
      setStravaMessage(err instanceof Error ? err.message : 'Strava sync failed')
    }
    setSyncingStrava(false)
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
              {/* Row 1: name + plan switcher + view toggle */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <div className="truncate text-base font-bold text-white">
                    {plan.planName ?? `${plan.goal.distanceKm}km Plan`}
                  </div>
                  {plans.length > 1 ? (
                    <select
                      value={plan.id}
                      onChange={(e) => switchPlan(e.target.value)}
                      className="shrink-0 rounded-lg border border-white/15 bg-black/30 px-2 py-0.5 text-xs text-white/70 outline-none focus:border-emerald-400/50"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.planName ?? `Plan ${p.raceDateISO}`}</option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5 shrink-0">
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
              </div>

              {/* Row 2: stat pills */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {plan.goal.distanceKm} km
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {formatPaceWithSpeed(plan.goal.targetPaceSecPerKm)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {plan.startDateISO} → {plan.raceDateISO}
                </span>
              </div>

              {/* Row 3: sync buttons */}
              <div className="mt-3 flex items-center gap-2">
                <StravaButton onClick={() => void syncFromStrava()} loading={syncingStrava} />
                <GarminButton onClick={() => void syncAll()} loading={syncingAll} />
              </div>
            </Card>

            {stravaMessage ? (
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                stravaMessage.includes('No matching') || stravaMessage.includes('failed') || stravaMessage.includes('Not signed')
                  ? 'border border-amber-500/20 bg-amber-500/10 text-amber-200'
                  : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              }`}>
                {stravaMessage}
              </div>
            ) : null}

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
                    {items.map((w) => {
                      const status = getWorkoutStatus(w, todayISO)
                      return (
                      <Card key={w.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${typeBadge(w.type)}`}>
                                {w.type}
                              </div>
                              {w.type !== 'rest' && <StatusBadge status={status} />}
                              {w.stravaSyncStatus === 'synced' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#FC4C02]/30 bg-[#FC4C02]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FC4C02]">
                                  S Strava
                                </span>
                              ) : null}
                              {w.garminSyncStatus === 'synced' ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#1F6DAA]/30 bg-[#1F6DAA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5BA3D0]">
                                  G Garmin
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm font-medium text-white">{w.title}</div>
                            <div className="mt-0.5 inline-flex items-center gap-2 text-xs text-white/50">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> {formatDurationShort(w.totalDurationSec)}
                              </span>
                              {typeof w.plannedDistanceKm === 'number' ? (
                                <span>· {w.plannedDistanceKm} km</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            {w.type !== 'rest' ? (
                              <Button size="md" onClick={() => nav(`/workout/${w.id}`)}>
                                <Play className="h-3.5 w-3.5" /> Start
                              </Button>
                            ) : null}
                            {w.type !== 'rest' && status !== 'completed' ? (
                              <Button variant="ghost" size="md" onClick={() => toggleComplete(w)}>
                                ✓ Done
                              </Button>
                            ) : null}
                            {w.type !== 'rest' && status === 'completed' ? (
                              <Button variant="ghost" size="md" onClick={() => toggleComplete(w)}>
                                Undo
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </Card>
                    )})}
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
