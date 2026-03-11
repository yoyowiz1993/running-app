/**
 * AI provider for generating running training plans.
 * Uses Gemini API (free tier) with structured JSON output.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type GoalInput = {
  distanceKm: number
  targetPaceSecPerKm: number
  raceDateISO: string
}

export type RunnerProfile = {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
  currentPaceSecPerKm?: number
  currentWeeklyKm?: number
  longestRecentRunKm?: number
}

export type AiPlanInput = {
  goal: GoalInput
  startDate: string
  endDate: string
  planName?: string
  runnerProfile: RunnerProfile
}

export type AiRawWorkout = {
  dateISO?: string
  title?: string
  type?: string
  plannedDistanceKm?: number
  totalDurationSec?: number
  stages?: Array<{
    label?: string
    kind?: string
    durationSec?: number
    targetPaceSecPerKm?: number
  }>
}

export type AiRawPlan = {
  workouts?: AiRawWorkout[]
}

function paceToReadable(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

const SYSTEM_PROMPT = `You are an elite running coach building a training plan. Return ONLY valid JSON — no markdown, no code fences, no commentary.

## Plan structure rules

WEEKLY TEMPLATE (adapt to the runner's available training days per week):
- Schedule exactly the number of running days the runner specifies. Remaining days are rest.
- NEVER alternate run/rest/run/rest. Group rest days together.
- Space hard sessions (tempo, intervals) at least 1-2 days apart with easy runs or rest between.
- Weekly pattern example for 4 days: Mon=easy, Wed=tempo, Fri=intervals, Sat=long, rest on Tue/Thu/Sun.

PERIODIZATION:
- Weeks 1–3: build phase — increase weekly volume ~8-10% per week.
- Week 4: recovery — reduce volume ~20-25% but keep all workout types.
- Repeat build/recovery cycle.
- Final 7–10 days before race: taper — reduce volume to ~60% of peak but keep 1-2 quality sessions at race pace.
- Race day: single workout of type "race" on the race date.

SHORT PLANS (under 4 weeks):
- Do NOT taper from day 1. Build or maintain for 60-70% of the plan, then taper the final 5-7 days.
- Still include 4-6 runs per week during the build phase.
- The long run should be at or near race distance (not half of it).

WORKOUT QUALITY:
- Easy runs: minimum 4 km (beginners) to 8 km (advanced). Easy pace = target pace + 60-90 sec/km.
- Long runs: 1.0x to 1.5x race distance during build phase. Pace = target + 60-90 sec/km.
- Tempo runs: 3-6 km at tempo pace (target + 10-20 sec/km), plus warmup and cooldown.
- Intervals: 4-8 repetitions of 400m-1000m at interval pace (target - 10-30 sec/km) with recovery jogs.
- Every tempo and interval workout MUST have a warmup (10-15 min easy) and cooldown (10-15 min easy).
- Rest days: type "rest" with a single stage of kind "rest" and durationSec 0.

PACING (all values in seconds per kilometer):
- If a current easy pace is provided, use it as the STARTING point for easy/long paces in week 1 and gradually bring paces closer to target over the plan.
- If no current pace is provided, derive paces from the target race pace:
  - Easy/long pace: targetPace + 60 to targetPace + 90
  - Tempo pace: targetPace + 10 to targetPace + 20
  - Interval pace: targetPace - 10 to targetPace - 30
- When current pace IS provided:
  - Easy runs in week 1: use current easy pace. Gradually reduce by 2-5 sec/km per week toward targetPace + 60.
  - Tempo: start at current pace - 20, progress toward targetPace + 15.
  - Intervals: start at current pace - 50, progress toward targetPace - 15.
- Race day pace: exactly targetPace.

DISTANCE GUIDELINES (adapt to race distance):
- 5K plan: easy 4-6 km, long 6-8 km, weekly total 20-35 km
- 10K plan: easy 5-8 km, long 8-12 km, weekly total 30-50 km
- Half marathon: easy 6-10 km, long 14-20 km, weekly total 40-65 km
- Marathon: easy 8-14 km, long 22-35 km, weekly total 50-90 km

## Output schema constraints
- Workout types: exactly one of "easy" | "long" | "tempo" | "intervals" | "race" | "rest".
- Stage kinds: exactly one of "warmup" | "easy" | "tempo" | "interval" | "recovery" | "cooldown" | "race" | "rest".
- All dates must be between startDate and endDate inclusive, format YYYY-MM-DD.
- totalDurationSec MUST equal the sum of all stages' durationSec.
- plannedDistanceKm must be realistic given pace and duration.
- Output ONLY the JSON object.`

function buildUserPrompt(input: AiPlanInput): string {
  const pace = paceToReadable(input.goal.targetPaceSecPerKm)
  const startD = new Date(input.startDate + 'T00:00:00Z')
  const endD = new Date(input.endDate + 'T00:00:00Z')
  const totalDays = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1
  const totalWeeks = Math.round(totalDays / 7 * 10) / 10

  const rp = input.runnerProfile
  const currentPaceNote = rp.currentPaceSecPerKm
    ? `\n- Current easy pace: ${paceToReadable(rp.currentPaceSecPerKm)} (${rp.currentPaceSecPerKm} sec/km)`
    : ''
  const weeklyKmNote = rp.currentWeeklyKm ? `\n- Current weekly mileage: ~${rp.currentWeeklyKm} km/week` : ''
  const longestRunNote = rp.longestRecentRunKm ? `\n- Longest recent run: ${rp.longestRecentRunKm} km` : ''

  return `Create a running training plan:
- Race distance: ${input.goal.distanceKm} km
- Target race pace: ${pace} (${input.goal.targetPaceSecPerKm} sec/km)
- Race date: ${input.goal.raceDateISO}
- Plan start: ${input.startDate}
- Plan end: ${input.endDate}
- Duration: ${totalDays} days (~${totalWeeks} weeks)
${input.planName ? `- Plan name: ${input.planName}` : ''}

RUNNER PROFILE:
- Fitness level: ${rp.fitnessLevel}
- Available training days per week: ${rp.daysPerWeek}${currentPaceNote}${weeklyKmNote}${longestRunNote}

IMPORTANT REQUIREMENTS:
- Generate a workout for EVERY day from ${input.startDate} to ${input.endDate} (${totalDays} days total).
- Schedule exactly ${rp.daysPerWeek} running days per week. The remaining ${7 - rp.daysPerWeek} days should be rest days.
- Do NOT alternate rest/run/rest/run. Cluster the rest days together.
${rp.fitnessLevel === 'beginner' ? '- BEGINNER: keep easy pace comfortable, shorter intervals (200-400m), focus on building base mileage gradually.' : ''}
${rp.fitnessLevel === 'advanced' ? '- ADVANCED: include longer intervals (800-1600m), tempo at higher intensity, consider doubles for high-volume weeks.' : ''}
${rp.currentPaceSecPerKm ? `- The runner's current easy pace is ${paceToReadable(rp.currentPaceSecPerKm)}. Start training paces from HERE and gradually progress toward target. Do NOT start all workouts at target pace — that's too fast for where they are now.` : ''}
${rp.currentWeeklyKm ? `- Start week 1 volume near ${rp.currentWeeklyKm} km and build from there (max +10%/week).` : ''}
${rp.longestRecentRunKm ? `- The runner has recently run ${rp.longestRecentRunKm} km in one run. Scale long runs appropriately from this base.` : ''}
- Long run should be ${input.goal.distanceKm >= 21 ? '18-32' : input.goal.distanceKm >= 10 ? '8-12' : '5-8'} km during peak weeks.
- Easy runs should be at least ${input.goal.distanceKm >= 21 ? '8' : input.goal.distanceKm >= 10 ? '5' : '4'} km.
${totalDays <= 21 ? '- SHORT PLAN: maintain high volume for the first 60-70% of days, only taper the final 5-7 days.' : ''}

Return JSON:
{
  "workouts": [
    {
      "dateISO": "YYYY-MM-DD",
      "title": "descriptive name",
      "type": "easy|long|tempo|intervals|race|rest",
      "plannedDistanceKm": number,
      "totalDurationSec": number,
      "stages": [
        {
          "label": "descriptive label",
          "kind": "warmup|easy|tempo|interval|recovery|cooldown|race|rest",
          "durationSec": number,
          "targetPaceSecPerKm": number
        }
      ]
    }
  ]
}`
}

export async function generatePlanFromAI(input: AiPlanInput): Promise<string> {
  const apiKey = process.env.AI_API_KEY?.trim()
  const model = process.env.AI_MODEL || 'gemini-2.5-flash-lite'
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured')
  }

  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536,
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
      finishReason?: string
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned no text content')
  }

  return text.trim()
}
