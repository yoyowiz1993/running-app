import { getApiBase } from './garmin'
import { supabase } from './supabase'

export type NutritionFood = {
  id: string
  description: string
  portions: Array<{ amount: number; unit: string; gramWeight?: number }>
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type NutritionLogEntry = {
  id: string
  user_id: string
  log_date: string
  food_fdc_id: string | null
  food_name: string
  amount: number
  unit: string
  calories: number
  protein: number | null
  carbs: number | null
  fat: number | null
  created_at: string
}

export async function searchFoods(query: string): Promise<NutritionFood[]> {
  if (!query || query.trim().length < 2) return []
  try {
    const base = await getApiBase()
    const res = await fetch(
      `${base}/api/nutrition/search?q=${encodeURIComponent(query.trim())}`,
      { credentials: 'omit', mode: 'cors' },
    )
    const data = (await res.json()) as { foods?: NutritionFood[]; error?: string }
    if (!res.ok) {
      throw new Error(data.error || `Nutrition search failed (${res.status})`)
    }
    if (data.error) {
      throw new Error(data.error)
    }
    return data.foods ?? []
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('Nutrition search failed')
  }
}

export async function addLogEntry(entry: {
  userId: string
  logDate: string
  foodFdcId: string | null
  foodName: string
  amount: number
  unit: string
  calories: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('nutrition_log').insert({
    user_id: entry.userId,
    log_date: entry.logDate,
    food_fdc_id: entry.foodFdcId,
    food_name: entry.foodName,
    amount: entry.amount,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein ?? null,
    carbs: entry.carbs ?? null,
    fat: entry.fat ?? null,
  })
  return { error: error?.message ?? null }
}

export async function getTodaysLog(userId: string): Promise<NutritionLogEntry[]> {
  if (!supabase) return []
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('nutrition_log')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', today)
    .order('created_at', { ascending: true })
  if (error) return []
  return (data ?? []) as NutritionLogEntry[]
}

export async function deleteLogEntry(userId: string, entryId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('nutrition_log')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}
