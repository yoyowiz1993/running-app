import { Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input, Label } from '../components/Field'
import { TopBar } from '../components/TopBar'
import {
  addLogEntry,
  deleteLogEntry,
  getTodaysLog,
  searchFoods,
  type NutritionFood,
  type NutritionLogEntry,
} from '../lib/nutrition'
import { supabase } from '../lib/supabase'

export function NutritionPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NutritionFood[]>([])
  const [searching, setSearching] = useState(false)
  const [todayLog, setTodayLog] = useState<NutritionLogEntry[]>([])
  const [selectedFood, setSelectedFood] = useState<NutritionFood | null>(null)
  const [addAmount, setAddAmount] = useState(1)
  const [addUnit, setAddUnit] = useState('serving')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    void loadTodayLog()
  }, [loadTodayLog])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setError(null)
      return
    }
    const t = window.setTimeout(() => {
      setSearching(true)
      setError(null)
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
    setError(null)
    setAdding(true)
    const calories = Math.round(selectedFood.calories * addAmount)
    const protein = selectedFood.protein ? Math.round(selectedFood.protein * addAmount) : null
    const carbs = selectedFood.carbs ? Math.round(selectedFood.carbs * addAmount) : null
    const fat = selectedFood.fat ? Math.round(selectedFood.fat * addAmount) : null
    const { error: err } = await addLogEntry({
      userId,
      logDate: new Date().toISOString().slice(0, 10),
      foodFdcId: selectedFood.id,
      foodName: selectedFood.description,
      amount: addAmount,
      unit: addUnit,
      calories,
      protein,
      carbs,
      fat,
    })
    setAdding(false)
    if (err) setError(err)
    else {
      setSelectedFood(null)
      setAddAmount(1)
      setAddUnit('serving')
      void loadTodayLog()
    }
  }

  async function handleDelete(entry: NutritionLogEntry) {
    if (!userId) return
    await deleteLogEntry(userId, entry.id)
    void loadTodayLog()
  }

  const totalCalories = todayLog.reduce((sum, e) => sum + (e.calories ?? 0), 0)
  const totalProtein = todayLog.reduce((sum, e) => sum + (e.protein ?? 0), 0)
  const totalCarbs = todayLog.reduce((sum, e) => sum + (e.carbs ?? 0), 0)
  const totalFat = todayLog.reduce((sum, e) => sum + (e.fat ?? 0), 0)

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Nutrition" />
      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
        <Card className="p-4">
          <Label>Search foods</Label>
          <div className="mt-1 flex gap-2">
            <Input
              placeholder="e.g. apple, chicken breast"
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
            <div className="mt-2 text-sm text-white/60">No foods found for that search.</div>
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
                      setAddUnit(first?.unit ?? 'serving')
                      setAddAmount(first?.amount ?? 1)
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    <div className="font-medium">{f.description}</div>
                    <div className="text-xs text-white/60">
                      {f.calories} cal per serving
                      {f.portions.length > 0 ? ` · ${f.portions.length} portion(s)` : ''}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      P {Math.round(f.protein)}g · C {Math.round(f.carbs)}g · F {Math.round(f.fat)}g
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedFood && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-medium text-white">{selectedFood.description}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
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
                    {selectedFood.portions.map((p, i) => (
                      <option key={i} value={p.unit}>
                        {p.amount} {p.unit}
                      </option>
                    ))}
                    {selectedFood.portions.length === 0 && (
                      <option value="serving">serving</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm text-white/70">
                  <div>≈ {Math.round(selectedFood.calories * addAmount)} cal</div>
                  <div className="text-xs text-white/50">
                    P {Math.round(selectedFood.protein * addAmount)}g · C {Math.round(selectedFood.carbs * addAmount)}g · F{' '}
                    {Math.round(selectedFood.fat * addAmount)}g
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setSelectedFood(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleAdd()} disabled={adding}>
                    <Plus className="h-4 w-4" /> Add
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

        <Card className="mt-4 p-4">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold text-white">Today&apos;s log</div>
            <div className="text-lg font-semibold text-emerald-300">{totalCalories} cal</div>
          </div>
          <div className="mt-2 text-xs text-white/60">
            Protein: {Math.round(totalProtein)}g · Carbs: {Math.round(totalCarbs)}g · Fat: {Math.round(totalFat)}g
          </div>
          {todayLog.length === 0 ? (
            <div className="mt-3 text-sm text-white/60">No entries yet. Search and add foods above.</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {todayLog.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{e.food_name}</div>
                    <div className="text-xs text-white/60">
                      {e.amount} {e.unit} · {e.calories} cal
                    </div>
                    <div className="text-xs text-white/50">
                      P {Math.round(e.protein ?? 0)}g · C {Math.round(e.carbs ?? 0)}g · F {Math.round(e.fat ?? 0)}g
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(e)}
                    className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-red-200"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
