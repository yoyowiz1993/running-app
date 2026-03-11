import { addDays, format, isAfter, isValid, parseISO, startOfDay } from 'date-fns'
import { Activity, ChevronRight, Flag, List, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Help, Input, Label, Select } from '../components/Field'
import { TopBar } from '../components/TopBar'
import { clampPace, parsePaceToSecPerKm } from '../lib/pace'
import { createProgram } from '../lib/programs'
import {
  deletePlan,
  loadActivePlan,
  loadPlans,
  saveGoal,
  savePlan,
  setActivePlanId,
} from '../lib/storage'
import type { RunningGoal, TrainingPlan } from '../lib/types'

function todayISO(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
      <span className="text-emerald-400">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wider text-white/40">{text}</span>
    </div>
  )
}

export function PlanPage() {
  const nav = useNavigate()
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadActivePlan())
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans())

  const defaultEndDate = format(addDays(new Date(), 56), 'yyyy-MM-dd')

  const [distanceKm, setDistanceKm] = useState('10')
  const [paceText, setPaceText] = useState('5:30')
  const [planName, setPlanName] = useState('')
  const [planStartDate, setPlanStartDate] = useState(() => todayISO())
  const [raceDate, setRaceDate] = useState(defaultEndDate)
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [daysPerWeek, setDaysPerWeek] = useState('4')
  const [currentPaceText, setCurrentPaceText] = useState('')
  const [currentWeeklyKm, setCurrentWeeklyKm] = useState('')
  const [longestRecentRunKm, setLongestRecentRunKm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function onCreatePlan(): Promise<void> {
    setError(null)

    const d = Number(distanceKm)
    const p = parsePaceToSecPerKm(paceText)
    const start = parseISO(planStartDate)
    const end = parseISO(raceDate)

    if (!Number.isFinite(d) || d <= 0) { setError('Enter a valid distance.'); return }
    if (!p) { setError('Enter pace like 5:30 (min:sec/km).'); return }
    if (!isValid(start) || !isValid(end)) { setError('Pick valid dates.'); return }
    if (isAfter(start, end)) { setError('Start date must be before race day.'); return }

    const goal: RunningGoal = {
      distanceKm: Math.round(d * 10) / 10,
      targetPaceSecPerKm: clampPace(p),
      raceDateISO: format(startOfDay(end), 'yyyy-MM-dd'),
      createdAtISO: new Date().toISOString(),
    }
    saveGoal(goal)

    const dpw = Math.max(2, Math.min(7, Number(daysPerWeek) || 4))
    const cpace = parsePaceToSecPerKm(currentPaceText)
    const cwk = Number(currentWeeklyKm)
    const lrr = Number(longestRecentRunKm)

    setCreating(true)
    try {
      const { plan: newPlan } = await createProgram({
        goal: { distanceKm: goal.distanceKm, targetPaceSecPerKm: goal.targetPaceSecPerKm, raceDateISO: goal.raceDateISO },
        planName: planName.trim() || undefined,
        startDate: planStartDate,
        endDate: goal.raceDateISO,
        runnerProfile: {
          fitnessLevel,
          daysPerWeek: dpw,
          ...(cpace ? { currentPaceSecPerKm: clampPace(cpace) } : {}),
          ...(Number.isFinite(cwk) && cwk > 0 ? { currentWeeklyKm: cwk } : {}),
          ...(Number.isFinite(lrr) && lrr > 0 ? { longestRecentRunKm: lrr } : {}),
        },
      })
      savePlan(newPlan)
      setPlan(newPlan)
      setPlans(loadPlans())
      nav('/calendar')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create program.')
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
    if (!window.confirm(`Delete "${p.planName ?? 'this plan'}"?`)) return
    setDeletingId(p.id)
    deletePlan(p.id)
    setPlan(loadActivePlan())
    setPlans(loadPlans())
    setDeletingId(null)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Training Plan" />

      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4">

        {/* ── Create form ── */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-emerald-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-white">Generate AI plan</div>
              <div className="text-xs text-white/40">Personalised training program</div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Race info */}
            <div className="space-y-3">
              <SectionLabel icon={<Flag className="h-3.5 w-3.5" />} text="Race details" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Distance (km)</Label>
                  <Input inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="10" />
                </div>
                <div>
                  <Label>Goal pace (min:sec/km)</Label>
                  <Input inputMode="numeric" value={paceText} onChange={(e) => setPaceText(e.target.value)} placeholder="5:30" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start training</Label>
                  <Input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Race day</Label>
                  <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Plan name <span className="text-white/30 font-normal">(optional)</span></Label>
                <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Spring 10k" />
              </div>
            </div>

            {/* Runner profile */}
            <div className="space-y-3">
              <SectionLabel icon={<Activity className="h-3.5 w-3.5" />} text="About you" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Level</Label>
                  <Select value={fitnessLevel} onChange={(e) => setFitnessLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                </div>
                <div>
                  <Label>Days / week</Label>
                  <Select value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)}>
                    <option value="3">3 days</option>
                    <option value="4">4 days</option>
                    <option value="5">5 days</option>
                    <option value="6">6 days</option>
                    <option value="7">7 days</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Easy pace</Label>
                  <Input inputMode="numeric" value={currentPaceText} onChange={(e) => setCurrentPaceText(e.target.value)} placeholder="6:30" />
                  <Help>Now</Help>
                </div>
                <div>
                  <Label>Weekly km</Label>
                  <Input inputMode="decimal" value={currentWeeklyKm} onChange={(e) => setCurrentWeeklyKm(e.target.value)} placeholder="20" />
                  <Help>Recent avg</Help>
                </div>
                <div>
                  <Label>Longest run</Label>
                  <Input inputMode="decimal" value={longestRecentRunKm} onChange={(e) => setLongestRecentRunKm(e.target.value)} placeholder="8" />
                  <Help>km</Help>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button size="lg" className="w-full" onClick={() => void onCreatePlan()} disabled={creating}>
              {creating ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating plan...
                </>
              ) : (
                <><Plus className="h-5 w-5" /> Generate AI plan</>
              )}
            </Button>
          </div>
        </Card>

        {/* ── Plan list ── */}
        {plans.length > 0 ? (
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-emerald-400" />
              <div className="text-sm font-semibold text-white">Your plans</div>
              <div className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">{plans.length}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              {plans.map((p) => {
                const isActive = plan?.id === p.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 rounded-xl transition ${isActive ? 'border border-emerald-500/30 bg-emerald-500/5' : 'border border-white/5 bg-black/20 hover:bg-black/30'}`}
                  >
                    <button
                      type="button"
                      onClick={() => { switchPlan(p.id); nav('/calendar') }}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">{p.planName ?? `Plan ${p.raceDateISO}`}</span>
                        {isActive ? <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">ACTIVE</span> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-white/40">
                        {p.workouts.filter((w) => w.type !== 'rest').length} workouts &middot; {p.startDateISO} &rarr; {p.raceDateISO}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeletePlan(p) }}
                      disabled={deletingId === p.id}
                      className="shrink-0 rounded-lg p-2 text-white/30 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { switchPlan(p.id); nav('/calendar') }}
                      className="shrink-0 rounded-lg p-2 text-white/30 transition hover:bg-white/10 hover:text-white/60"
                      aria-label="Open"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
