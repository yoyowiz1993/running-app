import confetti from 'canvas-confetti'
import { format, isAfter, isValid, parseISO, startOfDay } from 'date-fns'
import { ArrowLeft, ChevronRight, List, MapPin, Plus, Sparkles, Trophy, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Help, Input, Label, Select } from '../components/Field'
import { TopBar } from '../components/TopBar'
import { clampPace } from '../lib/pace'
import { createProgram } from '../lib/programs'
import { distanceLabelToKm, searchRaces, type RaceResult } from '../lib/races'
import {
  deletePlan,
  flushCloudSync,
  loadActivePlan,
  loadPlans,
  saveGoal,
  savePlan,
  setActivePlanId,
} from '../lib/storage'
import type { RunningGoal, TrainingPlan } from '../lib/types'

const CLASSIC_DISTANCES = [
  { label: '5K', value: '5' },
  { label: '10K', value: '10' },
  { label: '15K', value: '15' },
  { label: 'Half Marathon (21.1K)', value: '21.1' },
  { label: 'Marathon (42.2K)', value: '42.2' },
  { label: 'Custom', value: 'custom' },
]

const RACE_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '5K', label: '5K' },
  { value: '10K', label: '10K' },
  { value: 'Half Marathon', label: 'Half (21K)' },
  { value: 'Marathon', label: 'Marathon (42K)' },
]

const RADIUS_OPTIONS = [
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' },
  { value: '200', label: '200 km' },
]

function todayISO(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

function formatPaceFromSec(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export function PlanPage() {
  const nav = useNavigate()
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadActivePlan())
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans())

  // Distance
  const [distancePreset, setDistancePreset] = useState<string>('')
  const [customDistance, setCustomDistance] = useState('')

  // Race time (for pace calculation)
  const [raceHours, setRaceHours] = useState('')
  const [raceMinutes, setRaceMinutes] = useState('')
  const [raceSeconds, setRaceSeconds] = useState('')

  // Dates
  const [planName, setPlanName] = useState('')
  const [planStartDate, setPlanStartDate] = useState(() => todayISO())
  const [raceDate, setRaceDate] = useState('')

  // Runner profile
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [daysPerWeek, setDaysPerWeek] = useState('4')
  const [currentPaceText, setCurrentPaceText] = useState('')
  const [currentWeeklyKm, setCurrentWeeklyKm] = useState('')
  const [longestRecentRunKm, setLongestRecentRunKm] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [wizardStep, setWizardStep] = useState(0) // 0 = list, 1–6 = create steps

  // Goal entry: pick a race vs enter manually
  const [goalEntryMode, setGoalEntryMode] = useState<'race' | 'manual' | null>(null)
  const [selectedRace, setSelectedRace] = useState<RaceResult | null>(null)
  const [selectedRaceDistance, setSelectedRaceDistance] = useState<string>('') // when race has multiple distances
  const [raceLocation, setRaceLocation] = useState('Tel Aviv')
  const [raceRadius, setRaceRadius] = useState('50')
  const [raceType, setRaceType] = useState('')
  const [raceDateFrom, setRaceDateFrom] = useState(todayISO())
  const [raceDateTo, setRaceDateTo] = useState('')
  const [raceResults, setRaceResults] = useState<RaceResult[]>([])
  const [raceSearching, setRaceSearching] = useState(false)

  const distanceKm = distancePreset === 'custom'
    ? customDistance
    : distancePreset

  // Auto-calculate pace from race time + distance
  const calculatedPaceSec = useMemo(() => {
    const d = Number(distanceKm)
    const h = Number(raceHours || 0)
    const m = Number(raceMinutes || 0)
    const s = Number(raceSeconds || 0)
    const totalSec = h * 3600 + m * 60 + s
    if (!d || d <= 0 || totalSec <= 0) return null
    return Math.round(totalSec / d)
  }, [distanceKm, raceHours, raceMinutes, raceSeconds])

  // Parse current easy pace (min:sec format)
  function parseCurrentPace(text: string): number | null {
    if (!text.trim()) return null
    const parts = text.split(':')
    if (parts.length === 2) {
      const min = Number(parts[0])
      const sec = Number(parts[1])
      if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec
    }
    return null
  }

  async function onCreatePlan(): Promise<void> {
    setError(null)

    const d = Number(distanceKm)
    if (!Number.isFinite(d) || d <= 0) { setError('Select or enter a valid distance.'); return }
    if (!calculatedPaceSec) { setError('Enter your expected finish time to calculate pace.'); return }
    const paceClamp = clampPace(calculatedPaceSec)

    const start = parseISO(planStartDate)
    const end = parseISO(raceDate)
    if (!isValid(start) || !isValid(end)) { setError('Pick valid dates.'); return }
    if (isAfter(start, end)) { setError('Start date must be before race day.'); return }

    const goal: RunningGoal = {
      distanceKm: Math.round(d * 10) / 10,
      targetPaceSecPerKm: paceClamp,
      raceDateISO: format(startOfDay(end), 'yyyy-MM-dd'),
      createdAtISO: new Date().toISOString(),
    }
    saveGoal(goal)

    const dpw = Math.max(2, Math.min(7, Number(daysPerWeek) || 4))
    const cpace = parseCurrentPace(currentPaceText)
    const cwk = Number(currentWeeklyKm)
    const lrr = Number(longestRecentRunKm)

    const isFirstPlan = plans.length === 0
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
      await flushCloudSync()
      const afterPlans = loadPlans()
      setPlan(newPlan)
      setPlans(afterPlans)
      if (isFirstPlan) {
        void confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } })
      }
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

  async function onDeletePlan(p: TrainingPlan): Promise<void> {
    if (!window.confirm(`Delete "${p.planName ?? 'this plan'}"?`)) return
    setDeletingId(p.id)
    deletePlan(p.id)
    await flushCloudSync()
    setPlan(loadActivePlan())
    setPlans(loadPlans())
    setDeletingId(null)
  }

  function canProceedFromStep(step: number): boolean {
    if (step === 1) {
      if (goalEntryMode === null) return false
      if (goalEntryMode === 'manual') {
        const d = Number(distanceKm)
        return Number.isFinite(d) && d > 0
      }
      // race mode: need selected race and distance
      if (!selectedRace) return false
      if (selectedRace.distances.length === 1) return distanceLabelToKm(selectedRace.distances[0]) !== null
      return !!selectedRaceDistance && distanceLabelToKm(selectedRaceDistance) !== null
    }
    if (step === 2) {
      const h = Number(raceHours || 0)
      const m = Number(raceMinutes || 0)
      const s = Number(raceSeconds || 0)
      return h * 3600 + m * 60 + s > 0
    }
    if (step === 3) return !!raceDate && isValid(parseISO(raceDate))
    if (step === 4) {
      const start = parseISO(planStartDate)
      const end = parseISO(raceDate)
      return !!planStartDate && isValid(start) && isValid(end) && !isAfter(start, end)
    }
    return true // steps 5 and 6
  }

  function handleNext(): void {
    setError(null)
    if (!canProceedFromStep(wizardStep)) {
      if (wizardStep === 1) setError('Select or enter a valid distance.')
      else if (wizardStep === 2) setError('Set your goal finish time.')
      else if (wizardStep === 3) setError('Pick a race day.')
      else if (wizardStep === 4) setError('Pick a start date on or before race day.')
      return
    }
    setWizardStep((s) => s + 1)
  }

  const totalSteps = 6

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar
        title={wizardStep === 0 ? 'Training Plan' : `Step ${wizardStep} of ${totalSteps}`}
        right={
          wizardStep > 0 ? (
            <Button
              variant="ghost"
              onClick={() => setWizardStep((s) => (s === 1 ? 0 : s - 1))}
              className="text-white/80"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : undefined
        }
      />

      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4">

        {wizardStep === 0 ? (
          <>
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
              <Button size="lg" className="mt-5 w-full" onClick={() => setWizardStep(1)}>
                <Plus className="h-5 w-5" /> Create new plan
              </Button>
            </Card>

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
          </>
        ) : (
          <Card className="p-5">
            {wizardStep === 1 && (
              <>
                {goalEntryMode === null ? (
                  <>
                    <div className="text-base font-semibold text-white">How do you want to set your goal?</div>
                    <div className="mt-4 flex flex-col gap-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        className="w-full justify-start"
                        onClick={() => setGoalEntryMode('race')}
                      >
                        <Trophy className="h-5 w-5 shrink-0" />
                        Find a race
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        className="w-full justify-start"
                        onClick={() => setGoalEntryMode('manual')}
                      >
                        <span className="text-lg">✏️</span>
                        Enter distance & date manually
                      </Button>
                    </div>
                  </>
                ) : goalEntryMode === 'race' ? (
                  <>
                    <div className="text-base font-semibold text-white">Find your race</div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label>Location</Label>
                        <Input
                          placeholder="e.g. Tel Aviv, Jerusalem"
                          value={raceLocation}
                          onChange={(e) => setRaceLocation(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Radius</Label>
                          <Select value={raceRadius} onChange={(e) => setRaceRadius(e.target.value)}>
                            {RADIUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label>Race type</Label>
                          <Select value={raceType} onChange={(e) => setRaceType(e.target.value)}>
                            {RACE_TYPE_OPTIONS.map((o) => (
                              <option key={o.value || 'any'} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>From date</Label>
                          <Input type="date" value={raceDateFrom} onChange={(e) => setRaceDateFrom(e.target.value)} />
                        </div>
                        <div>
                          <Label>To date (optional)</Label>
                          <Input type="date" value={raceDateTo} onChange={(e) => setRaceDateTo(e.target.value)} />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={async () => {
                          if (!raceLocation.trim()) { setError('Enter location'); return }
                          setError(null); setRaceSearching(true)
                          try {
                            const results = await searchRaces({
                              location: raceLocation.trim(),
                              radiusKm: Number(raceRadius) || 50,
                              dateFrom: raceDateFrom || undefined,
                              dateTo: raceDateTo || undefined,
                              distances: raceType ? [raceType] : undefined,
                            })
                            setRaceResults(results)
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Search failed')
                            setRaceResults([])
                          } finally {
                            setRaceSearching(false)
                          }
                        }}
                        disabled={raceSearching}
                      >
                        {raceSearching ? <>Searching...</> : <>Search races</>}
                      </Button>
                      {raceResults.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {raceResults.map((race, i) => (
                            <button
                              key={`${race.name}-${i}`}
                              type="button"
                              onClick={() => {
                                setSelectedRace(race)
                                setRaceDate(race.date)
                                if (race.distances.length === 1) {
                                  const km = distanceLabelToKm(race.distances[0])
                                  if (km !== null) {
                                    const match = CLASSIC_DISTANCES.find((d) => Number(d.value) === km)
                                    setDistancePreset(match ? match.value : 'custom')
                                    setCustomDistance(match ? '' : String(km))
                                    setSelectedRaceDistance(race.distances[0])
                                  }
                                } else {
                                  setSelectedRaceDistance('')
                                }
                              }}
                              className={`w-full rounded-xl border p-3 text-left transition ${
                                selectedRace?.name === race.name && selectedRace?.date === race.date
                                  ? 'border-emerald-500/50 bg-emerald-500/10'
                                  : 'border-white/10 bg-black/20 hover:bg-white/5'
                              }`}
                            >
                              <div className="font-medium text-white">{race.name}</div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                                <MapPin className="h-3 w-3" /> {race.city} · {race.date}
                              </div>
                              {race.distances.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {race.distances.map((d) => (
                                    <span key={d} className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedRace && selectedRace.distances.length > 1 && !selectedRaceDistance && (
                        <div>
                          <Label>Which distance are you running?</Label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedRace.distances.map((d) => {
                              const km = distanceLabelToKm(d)
                              if (km === null) return null
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    setSelectedRaceDistance(d)
                                    const match = CLASSIC_DISTANCES.find((x) => Number(x.value) === km)
                                    setDistancePreset(match ? match.value : 'custom')
                                    setCustomDistance(match ? '' : String(km))
                                  }}
                                  className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                                >
                                  {d}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-semibold text-white">Pick your race distance</div>
                    <div className="mt-4 space-y-3">
                      <Label>Race distance</Label>
                      <Select
                        value={distancePreset}
                        onChange={(e) => { setDistancePreset(e.target.value); setCustomDistance('') }}
                      >
                        <option value="" disabled>Select distance…</option>
                        {CLASSIC_DISTANCES.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </Select>
                      {distancePreset === 'custom' && (
                        <div>
                          <Label>Custom distance (km)</Label>
                          <Input
                            inputMode="decimal"
                            value={customDistance}
                            onChange={(e) => setCustomDistance(e.target.value)}
                            placeholder="e.g. 8"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {wizardStep === 2 && (
              <>
                <div className="text-base font-semibold text-white">Set your goal finish time</div>
                <div className="mt-4 space-y-3">
                  <Label>Goal time (h : m : s)</Label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        inputMode="numeric"
                        value={raceHours}
                        onChange={(e) => setRaceHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="0"
                        maxLength={2}
                        title="Hours"
                      />
                      <Help>hrs</Help>
                    </div>
                    <div>
                      <Input
                        inputMode="numeric"
                        value={raceMinutes}
                        onChange={(e) => setRaceMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="25"
                        maxLength={2}
                        title="Minutes"
                      />
                      <Help>min</Help>
                    </div>
                    <div>
                      <Input
                        inputMode="numeric"
                        value={raceSeconds}
                        onChange={(e) => setRaceSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="30"
                        maxLength={2}
                        title="Seconds"
                      />
                      <Help>sec</Help>
                    </div>
                  </div>
                  {calculatedPaceSec ? (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1.5">
                      <span className="text-xs text-white/50">Calculated pace:</span>
                      <span className="text-sm font-semibold text-emerald-300">{formatPaceFromSec(calculatedPaceSec)}</span>
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {wizardStep === 3 && (
              <>
                <div className="text-base font-semibold text-white">When is race day?</div>
                <div className="mt-4">
                  <Label>Pick race day</Label>
                  <Input
                    type="date"
                    value={raceDate}
                    onChange={(e) => setRaceDate(e.target.value)}
                    min={todayISO()}
                    title="Race day"
                  />
                </div>
              </>
            )}

            {wizardStep === 4 && (
              <>
                <div className="text-base font-semibold text-white">When do you start training?</div>
                <div className="mt-4">
                  <Label>Pick start date</Label>
                  <Input
                    type="date"
                    value={planStartDate}
                    onChange={(e) => setPlanStartDate(e.target.value)}
                    min={todayISO()}
                    max={raceDate || undefined}
                    title="Start training"
                  />
                </div>
              </>
            )}

            {wizardStep === 5 && (
              <>
                <div className="text-base font-semibold text-white">Name your plan</div>
                <div className="mt-4">
                  <Label>Plan name <span className="text-white/30 font-normal">(optional)</span></Label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Spring 10k" />
                </div>
              </>
            )}

            {wizardStep === 6 && (
              <>
                <div className="text-base font-semibold text-white">About you</div>
                <div className="mt-4 space-y-4">
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
                  <div className="space-y-3">
                    <div>
                      <Label>Easy pace <span className="text-white/30 font-normal">(optional)</span></Label>
                      <Input
                        value={currentPaceText}
                        onChange={(e) => setCurrentPaceText(e.target.value)}
                        placeholder="5:30"
                        title="min:sec per km"
                      />
                      <Help>min:sec/km</Help>
                    </div>
                    <div>
                      <Label>Weekly km <span className="text-white/30 font-normal">(optional)</span></Label>
                      <Input
                        inputMode="decimal"
                        value={currentWeeklyKm}
                        onChange={(e) => setCurrentWeeklyKm(e.target.value)}
                        placeholder="e.g. 35"
                        title="Recent weekly avg"
                      />
                      <Help>Recent avg</Help>
                    </div>
                    <div>
                      <Label>Longest run <span className="text-white/30 font-normal">(optional)</span></Label>
                      <Input
                        inputMode="decimal"
                        value={longestRecentRunKm}
                        onChange={(e) => setLongestRecentRunKm(e.target.value)}
                        placeholder="e.g. 21"
                        title="km"
                      />
                      <Help>km</Help>
                    </div>
                  </div>
                </div>
              </>
            )}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              {wizardStep < 6 ? (
                <Button size="lg" className="flex-1" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => void onCreatePlan()}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    <><Plus className="h-5 w-5" /> Generate AI plan</>
                  )}
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
