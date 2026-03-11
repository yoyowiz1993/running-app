import { ChevronDown, ChevronUp, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input, Label, Select } from '../components/Field'
import { TopBar } from '../components/TopBar'
import {
  addLogEntry,
  deleteLogEntry,
  deriveMacroGrams,
  getTodaysLog,
  loadNutritionGoals,
  loadSuggestionsFromSession,
  saveNutritionGoals,
  saveSuggestionsToSession,
  searchFoods,
  suggestMeals,
  type NutritionFood,
  type NutritionGoals,
  type NutritionLogEntry,
  type SuggestedMeal,
} from '../lib/nutrition'
import { supabase } from '../lib/supabase'

const FALLBACK_UNITS_IN_GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1, oz: 28.3495, lb: 453.592,
  cup: 240, tbsp: 15, tsp: 5, ml: 1,
}

function normalizeUnit(unit: string): string {
  const key = unit.trim().toLowerCase()
  if (key === 'gram' || key === 'grams') return 'g'
  return key
}

function getUnitGrams(food: NutritionFood, unit: string): number | null {
  const normalizedUnit = normalizeUnit(unit)
  const portion = food.portions.find(
    (p) => normalizeUnit(p.unit) === normalizedUnit && p.gramWeight && p.amount > 0,
  )
  if (portion?.gramWeight && portion.amount > 0) return portion.gramWeight / portion.amount
  const fallback = FALLBACK_UNITS_IN_GRAMS[normalizedUnit]
  return typeof fallback === 'number' ? fallback : null
}

function getMultiplier(food: NutritionFood, amount: number, unit: string): number {
  const safeAmount = amount > 0 ? amount : 1
  const normalizedUnit = normalizeUnit(unit)
  const unitGrams = getUnitGrams(food, unit)
  if (['g', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'ml'].includes(normalizedUnit)) {
    if (unitGrams) return (safeAmount * unitGrams) / 100
  }
  if (unitGrams) return (safeAmount * unitGrams) / 100
  const matchingPortion = food.portions.find((p) => normalizeUnit(p.unit) === normalizedUnit && p.amount > 0)
  if (matchingPortion) return safeAmount / matchingPortion.amount
  return safeAmount
}

function getUnitOptions(food: NutritionFood): string[] {
  const fromApi = food.portions.map((p) => normalizeUnit(p.unit)).filter((u) => u.length > 0)
  const merged = ['g', ...fromApi, ...Object.keys(FALLBACK_UNITS_IN_GRAMS), 'serving']
  return Array.from(new Set(merged))
}

// ── Calorie ring (SVG arc) ────────────────────────────────────────────
function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0
  const dash = pct * circ
  const over = consumed > goal

  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke={over ? '#f87171' : 'url(#calGrad)'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <defs>
          <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <div className={`text-2xl font-bold ${over ? 'text-red-400' : 'text-white'}`}>{consumed}</div>
        <div className="text-[10px] text-white/40">/ {goal} cal</div>
        <div className="text-[10px] font-medium text-white/50">{Math.round(pct * 100)}%</div>
      </div>
    </div>
  )
}

// ── Macro bar ─────────────────────────────────────────────────────────
function MacroBar({
  label, consumed, goal, gradient,
}: {
  label: string; consumed: number; goal: number; gradient: string
}) {
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0
  const over = consumed > goal
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs font-medium mb-1.5">
        <span className="text-white/70">{label}</span>
        <span className={over ? 'text-red-400' : 'text-white/50'}>{consumed}g <span className="text-white/30">/ {goal}g</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${over ? 'bg-red-400' : gradient} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-white/30">{Math.round(pct)}% of goal</div>
    </div>
  )
}

// ── Goals editor ─────────────────────────────────────────────────────
function GoalsEditor({ goals, onSave }: { goals: NutritionGoals; onSave: (g: NutritionGoals) => void }) {
  const [calories, setCalories] = useState(String(goals.calories))
  const [proteinPct, setProteinPct] = useState(String(goals.proteinPct))
  const [carbsPct, setCarbsPct] = useState(String(goals.carbsPct))
  const [fatPct, setFatPct] = useState(String(goals.fatPct))
  const [saved, setSaved] = useState(false)

  const sum = Number(proteinPct) + Number(carbsPct) + Number(fatPct)
  const valid = sum === 100 && Number(calories) > 0

  function handleSave() {
    if (!valid) return
    const g: NutritionGoals = {
      calories: Math.round(Number(calories)),
      proteinPct: Number(proteinPct),
      carbsPct: Number(carbsPct),
      fatPct: Number(fatPct),
    }
    saveNutritionGoals(g)
    onSave(g)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Daily calorie target</Label>
        <Input inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="2000" />
      </div>

      <div className="space-y-1">
        <Label>Macro split <span className="text-white/30 font-normal">(must total 100%)</span></Label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="mb-1 text-xs text-sky-400 font-medium">Protein %</div>
            <Input inputMode="numeric" value={proteinPct} onChange={(e) => setProteinPct(e.target.value)} placeholder="30" />
          </div>
          <div>
            <div className="mb-1 text-xs text-emerald-400 font-medium">Carbs %</div>
            <Input inputMode="numeric" value={carbsPct} onChange={(e) => setCarbsPct(e.target.value)} placeholder="45" />
          </div>
          <div>
            <div className="mb-1 text-xs text-amber-400 font-medium">Fat %</div>
            <Input inputMode="numeric" value={fatPct} onChange={(e) => setFatPct(e.target.value)} placeholder="25" />
          </div>
        </div>
        <div className={`text-xs ${sum === 100 ? 'text-emerald-400' : 'text-red-400'}`}>
          Total: {sum}% {sum !== 100 ? `(needs ${100 - sum > 0 ? '+' : ''}${100 - sum}% adjustment)` : '✓'}
        </div>
      </div>

      <Button
        variant={saved ? 'secondary' : 'primary'}
        className="w-full"
        onClick={handleSave}
        disabled={!valid}
      >
        {saved ? 'Goals saved!' : 'Save goals'}
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export function NutritionPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [goals, setGoals] = useState<NutritionGoals>(() => loadNutritionGoals())
  const [showGoals, setShowGoals] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NutritionFood[]>([])
  const [searching, setSearching] = useState(false)
  const [todayLog, setTodayLog] = useState<NutritionLogEntry[]>([])
  const [selectedFood, setSelectedFood] = useState<NutritionFood | null>(null)
  const [addAmount, setAddAmount] = useState(1)
  const [addUnit, setAddUnit] = useState('serving')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mealCount, setMealCount] = useState('3')
  const [suggestions, setSuggestions] = useState<SuggestedMeal[]>(() => loadSuggestionsFromSession())
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [expandedMeals, setExpandedMeals] = useState<Set<number>>(new Set())
  const [loggingMealIndex, setLoggingMealIndex] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    supabase?.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user?.id ?? null)
    })
    return () => { mounted = false }
  }, [])

  const loadTodayLog = useCallback(async () => {
    if (!userId) return
    const log = await getTodaysLog(userId)
    setTodayLog(log)
  }, [userId])

  useEffect(() => { void loadTodayLog() }, [loadTodayLog])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]); setError(null); return
    }
    const t = window.setTimeout(() => {
      setSearching(true); setError(null)
      searchFoods(searchQuery)
        .then((foods) => setSearchResults(foods))
        .catch((err: unknown) => {
          setSearchResults([])
          setError(err instanceof Error ? err.message : 'Failed to search foods')
        })
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  async function handleAdd() {
    if (!userId || !selectedFood) return
    setError(null); setAdding(true)
    const multiplier = getMultiplier(selectedFood, addAmount, addUnit)
    const calories = Math.round(selectedFood.calories * multiplier)
    const protein = selectedFood.protein ? Math.round(selectedFood.protein * multiplier) : null
    const carbs = selectedFood.carbs ? Math.round(selectedFood.carbs * multiplier) : null
    const fat = selectedFood.fat ? Math.round(selectedFood.fat * multiplier) : null
    const { error: err } = await addLogEntry({
      userId, logDate: new Date().toISOString().slice(0, 10),
      foodFdcId: selectedFood.id, foodName: selectedFood.description,
      amount: addAmount, unit: addUnit, calories, protein, carbs, fat,
    })
    setAdding(false)
    if (err) setError(err)
    else {
      setSelectedFood(null); setAddAmount(1); setAddUnit('serving')
      void loadTodayLog()
    }
  }

  async function handleDelete(entry: NutritionLogEntry) {
    if (!userId) return
    await deleteLogEntry(userId, entry.id)
    void loadTodayLog()
  }

  async function handleSuggest() {
    setSuggestError(null)
    setSuggesting(true)
    try {
      const consumed = {
        calories: todayLog.reduce((s, e) => s + (e.calories ?? 0), 0),
        protein: Math.round(todayLog.reduce((s, e) => s + (e.protein ?? 0), 0)),
        carbs: Math.round(todayLog.reduce((s, e) => s + (e.carbs ?? 0), 0)),
        fat: Math.round(todayLog.reduce((s, e) => s + (e.fat ?? 0), 0)),
      }
      const meals = await suggestMeals({ goals, alreadyConsumed: consumed, mealCount: Number(mealCount) })
      setSuggestions(meals)
      saveSuggestionsToSession(meals)
      setExpandedMeals(new Set())
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Failed to generate suggestions.')
    } finally {
      setSuggesting(false)
    }
  }

  async function handleLogMeal(meal: SuggestedMeal, index: number) {
    if (!userId) return
    setLoggingMealIndex(index)
    await addLogEntry({
      userId,
      logDate: new Date().toISOString().slice(0, 10),
      foodFdcId: null,
      foodName: meal.name,
      amount: 1,
      unit: 'meal',
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    })
    setLoggingMealIndex(null)
    void loadTodayLog()
  }

  const totalCalories = todayLog.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalProtein = Math.round(todayLog.reduce((s, e) => s + (e.protein ?? 0), 0))
  const totalCarbs = Math.round(todayLog.reduce((s, e) => s + (e.carbs ?? 0), 0))
  const totalFat = Math.round(todayLog.reduce((s, e) => s + (e.fat ?? 0), 0))
  const { proteinG, carbsG, fatG } = deriveMacroGrams(goals)
  const selectedMultiplier = selectedFood ? getMultiplier(selectedFood, addAmount, addUnit) : 1

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Nutrition" />
      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4">

        {/* ── Daily summary ── */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Today</div>
            <button
              type="button"
              onClick={() => setShowGoals((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white transition"
            >
              Edit goals {showGoals ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {showGoals ? (
            <div className="mt-3 border-t border-white/5 pt-3">
              <GoalsEditor goals={goals} onSave={setGoals} />
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-center">
            <CalorieRing consumed={totalCalories} goal={goals.calories} />
          </div>

          <div className="mt-4 flex gap-4">
            <MacroBar label="Protein" consumed={totalProtein} goal={proteinG} gradient="bg-sky-400" />
            <MacroBar label="Carbs" consumed={totalCarbs} goal={carbsG} gradient="bg-emerald-400" />
            <MacroBar label="Fat" consumed={totalFat} goal={fatG} gradient="bg-amber-400" />
          </div>
        </Card>

        {/* ── AI meal suggestions ── */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">AI meal suggestions</div>
              <div className="text-xs text-white/40">Based on your remaining goals for today</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <Select value={mealCount} onChange={(e) => setMealCount(e.target.value)}>
                <option value="1">1 meal</option>
                <option value="2">2 meals</option>
                <option value="3">3 meals</option>
                <option value="4">4 meals</option>
                <option value="5">5 meals</option>
              </Select>
            </div>
            <Button onClick={() => void handleSuggest()} disabled={suggesting} className="shrink-0">
              {suggesting ? (
                <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Suggest</>
              )}
            </Button>
          </div>

          {suggestError ? (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {suggestError}
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="mt-4 space-y-3">
              {suggestions.map((meal, i) => {
                const isExpanded = expandedMeals.has(i)
                return (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-white">{meal.name}</div>
                          <div className="mt-0.5 text-xs text-white/50">{meal.description}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-amber-400">{meal.calories} cal</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-2 text-xs">
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">P {meal.protein}g</span>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">C {meal.carbs}g</span>
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">F {meal.fat}g</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="md"
                          disabled={loggingMealIndex === i}
                          onClick={() => void handleLogMeal(meal, i)}
                        >
                          {loggingMealIndex === i ? (
                            <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Logging...</>
                          ) : (
                            <><Plus className="h-3.5 w-3.5" /> Log this meal</>
                          )}
                        </Button>
                      </div>
                    </div>
                    {meal.ingredients.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedMeals((prev) => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i); else next.add(i)
                            return next
                          })}
                          className="flex w-full items-center justify-between border-t border-white/5 px-3 py-2 text-xs text-white/40 hover:bg-white/5 transition"
                        >
                          <span>Ingredients ({meal.ingredients.length})</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {isExpanded ? (
                          <ul className="border-t border-white/5 px-3 py-2 space-y-1">
                            {meal.ingredients.map((ing, j) => (
                              <li key={j} className="flex justify-between text-xs">
                                <span className="text-white/70">{ing.item}</span>
                                <span className="text-white/40">{ing.amount}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </Card>

        {/* ── Search ── */}
        <Card className="p-4">
          <Label>Search foods</Label>
          <div className="mt-1 flex gap-2">
            <Input
              placeholder="e.g. chicken breast, apple"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <span className="flex items-center text-white/50">
              <Search className="h-5 w-5" />
            </span>
          </div>

          {searching && <div className="mt-2 text-sm text-white/60">Searching...</div>}
          {!searching && searchQuery.trim().length >= 2 && !error && searchResults.length === 0 && (
            <div className="mt-2 text-sm text-white/60">No foods found.</div>
          )}

          {searchResults.length > 0 && !selectedFood && (
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {searchResults.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFood(f)
                      const first = f.portions[0]
                      setAddUnit(first?.unit ?? 'g')
                      setAddAmount(first?.amount ?? 1)
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                  >
                    <div className="font-medium">{f.description}</div>
                    <div className="mt-0.5 flex gap-3 text-xs text-white/50">
                      <span>{f.calories} cal</span>
                      <span>P {Math.round(f.protein)}g</span>
                      <span>C {Math.round(f.carbs)}g</span>
                      <span>F {Math.round(f.fat)}g</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedFood && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-sm font-semibold text-white">{selectedFood.description}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number" min={0.25} step={0.25}
                    value={addAmount}
                    onChange={(e) => setAddAmount(Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <select
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-400/50"
                  >
                    {getUnitOptions(selectedFood).map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-semibold text-white">{Math.round(selectedFood.calories * selectedMultiplier)} cal</div>
                  <div className="text-xs text-white/50">
                    P {Math.round(selectedFood.protein * selectedMultiplier)}g &middot;
                    C {Math.round(selectedFood.carbs * selectedMultiplier)}g &middot;
                    F {Math.round(selectedFood.fat * selectedMultiplier)}g
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSelectedFood(null)}>Cancel</Button>
                  <Button onClick={() => void handleAdd()} disabled={adding}>
                    <Plus className="h-4 w-4" /> {adding ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}
        </Card>

        {/* ── Log ── */}
        {todayLog.length > 0 ? (
          <Card className="p-4">
            <div className="text-sm font-semibold text-white">Food log</div>
            <ul className="mt-3 space-y-1.5">
              {todayLog.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{e.food_name}</div>
                    <div className="text-xs text-white/50">
                      {e.amount} {e.unit} &middot; <span className="text-white/70">{e.calories} cal</span>
                    </div>
                    <div className="text-xs text-white/30">
                      P {Math.round(e.protein ?? 0)}g &middot; C {Math.round(e.carbs ?? 0)}g &middot; F {Math.round(e.fat ?? 0)}g
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(e)}
                    className="shrink-0 rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/20 hover:text-red-300"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
