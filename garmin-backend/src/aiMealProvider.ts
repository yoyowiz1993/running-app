/**
 * AI provider for generating meal suggestions.
 * Uses AI_MEAL_API_KEY if set, otherwise falls back to AI_API_KEY.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type MealSuggestionInput = {
  goals: { calories: number; proteinPct: number; carbsPct: number; fatPct: number }
  alreadyConsumed: { calories: number; protein: number; carbs: number; fat: number }
  mealCount: number
}

export type SuggestedMeal = {
  name: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: Array<{ item: string; amount: string }>
}

const SYSTEM_PROMPT = `You are a professional nutritionist and meal planner. Your job is to suggest realistic, practical meals that fit a user's remaining daily calorie and macro targets.

Rules:
- Return ONLY valid JSON — no markdown, no code fences, no commentary.
- Suggest exactly the number of meals requested.
- Each meal must be a real, named dish with practical ingredients and amounts.
- Distribute the remaining calories roughly equally across the meals.
- Match macros proportionally to the user's goal split (protein %, carbs %, fat %).
- Keep meals varied — do not repeat the same dish.
- Ingredients must include realistic amounts (e.g. "200g", "1 cup", "2 tbsp").
- The sum of all suggested meals' calories should roughly equal the remaining calories.
- Output ONLY the JSON object, nothing else.`

function buildPrompt(input: MealSuggestionInput): string {
  const { goals, alreadyConsumed, mealCount } = input

  const remainingCal = Math.max(0, goals.calories - alreadyConsumed.calories)
  const proteinGoalG = Math.round((goals.calories * goals.proteinPct / 100) / 4)
  const carbsGoalG = Math.round((goals.calories * goals.carbsPct / 100) / 4)
  const fatGoalG = Math.round((goals.calories * goals.fatPct / 100) / 9)

  const remainingProtein = Math.max(0, proteinGoalG - alreadyConsumed.protein)
  const remainingCarbs = Math.max(0, carbsGoalG - alreadyConsumed.carbs)
  const remainingFat = Math.max(0, fatGoalG - alreadyConsumed.fat)

  const perMealCal = mealCount > 0 ? Math.round(remainingCal / mealCount) : remainingCal

  return `Suggest ${mealCount} meal${mealCount !== 1 ? 's' : ''} to complete my nutrition goals for today.

DAILY GOALS:
- Total calories: ${goals.calories} kcal
- Protein: ${goals.proteinPct}% (${proteinGoalG}g)
- Carbs: ${goals.carbsPct}% (${carbsGoalG}g)
- Fat: ${goals.fatPct}% (${fatGoalG}g)

ALREADY CONSUMED TODAY:
- Calories: ${alreadyConsumed.calories} kcal
- Protein: ${alreadyConsumed.protein}g
- Carbs: ${alreadyConsumed.carbs}g
- Fat: ${alreadyConsumed.fat}g

REMAINING TO HIT GOALS:
- Calories: ${remainingCal} kcal (≈ ${perMealCal} kcal per meal)
- Protein: ${remainingProtein}g
- Carbs: ${remainingCarbs}g
- Fat: ${remainingFat}g

Return exactly ${mealCount} meal suggestion${mealCount !== 1 ? 's' : ''} as JSON:
{
  "meals": [
    {
      "name": "Meal name",
      "description": "One sentence description",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "ingredients": [
        { "item": "ingredient name", "amount": "amount with unit" }
      ]
    }
  ]
}`
}

export async function generateMealSuggestions(input: MealSuggestionInput): Promise<SuggestedMeal[]> {
  const apiKey = (process.env.AI_MEAL_API_KEY || process.env.AI_API_KEY)?.trim()
  const model = process.env.AI_MODEL || 'gemini-3.1-flash-lite-preview'
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AI API error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned no text content')
  }

  const parsed = parseJsonSafe(text.trim())
  const meals = Array.isArray(parsed?.meals) ? parsed.meals : []
  if (meals.length === 0) throw new Error('AI returned no meal suggestions')

  return (meals as Record<string, unknown>[]).map((m) => ({
    name: String(m.name ?? 'Meal'),
    description: String(m.description ?? ''),
    calories: Math.round(Number(m.calories) || 0),
    protein: Math.round(Number(m.protein) || 0),
    carbs: Math.round(Number(m.carbs) || 0),
    fat: Math.round(Number(m.fat) || 0),
    ingredients: Array.isArray(m.ingredients)
      ? (m.ingredients as Record<string, unknown>[]).map((ing) => ({
          item: String(ing.item ?? ''),
          amount: String(ing.amount ?? ''),
        }))
      : [],
  }))
}

function parseJsonSafe(raw: string): { meals?: unknown[] } | null {
  let text = raw.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) text = text.slice(start, end + 1)
  // Strip comments and trailing commas
  text = text.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (_, s) => s ?? '')
  text = text.replace(/,\s*([\]}])/g, '$1')
  try {
    return JSON.parse(text) as { meals?: unknown[] }
  } catch {
    return null
  }
}
