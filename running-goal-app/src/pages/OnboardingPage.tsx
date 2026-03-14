import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Dumbbell, Flag, List, Plus, Sparkles, Target, Utensils } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input, Label } from '../components/Field'
import { setOnboardingComplete } from '../lib/storage'
import { loadNutritionGoals, saveNutritionGoals, type NutritionGoals } from '../lib/nutrition'

const MACRO_PRESETS: Array<{ label: string; goals: Pick<NutritionGoals, 'proteinPct' | 'carbsPct' | 'fatPct'> }> = [
  { label: 'Balanced', goals: { proteinPct: 30, carbsPct: 45, fatPct: 25 } },
  { label: 'High protein', goals: { proteinPct: 35, carbsPct: 40, fatPct: 25 } },
  { label: 'Low carb', goals: { proteinPct: 30, carbsPct: 25, fatPct: 45 } },
]

const SCREENS = [
  {
    id: 1,
    title: 'Train smarter for your race',
    subtitle: 'AI-powered plans, guided workouts, and nutrition tracking — all in one place.',
    icon: Sparkles,
    features: [
      { label: 'AI Training Plans', icon: Dumbbell },
      { label: 'Guided Workouts', icon: Flag },
      { label: 'Nutrition Tracking', icon: Utensils },
    ],
  },
  {
    id: 2,
    title: 'How it works',
    subtitle: 'Pick a goal, get your personalised plan, and follow along — simple as that.',
    icon: List,
    steps: ['Pick a goal (5K, 10K, half, marathon)', 'Get your AI plan', 'Follow workouts & track nutrition'],
  },
  {
    id: 3,
    title: 'Fuel your training',
    subtitle: 'Set calorie goals, log food, and get AI meal suggestions tailored to your remaining macros.',
    icon: Utensils,
    features: [
      { label: 'Set daily calorie & macro goals', icon: Target },
      { label: 'Log food (search or add manually)', icon: Plus },
      { label: 'AI suggests meals → one tap to log', icon: Sparkles },
    ],
  },
  {
    id: 4,
    title: 'Set your nutrition goals',
    subtitle: 'Optional — you can change this anytime in the Nutrition tab.',
    icon: Target,
    nutritionForm: true,
  },
  {
    id: 5,
    title: "Let's create your plan",
    subtitle: "You're a few taps away from your first training plan.",
    icon: Dumbbell,
    cta: 'Create your first plan',
  },
]

type OnboardingPageProps = { onComplete?: () => void }

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const nav = useNavigate()
  const [screen, setScreen] = useState(0)
  const [nutritionCalories, setNutritionCalories] = useState(() => String(loadNutritionGoals().calories))
  const [nutritionPreset, setNutritionPreset] = useState(0)
  const current = SCREENS[screen]
  const isLast = screen === SCREENS.length - 1

  function handleNext() {
    if ((current as { nutritionForm?: boolean }).nutritionForm) {
      const cal = Math.round(Number(nutritionCalories)) || 2000
      const preset = MACRO_PRESETS[nutritionPreset] ?? MACRO_PRESETS[0]
      saveNutritionGoals({
        calories: Math.max(100, Math.min(10000, cal)),
        proteinPct: preset.goals.proteinPct,
        carbsPct: preset.goals.carbsPct,
        fatPct: preset.goals.fatPct,
      })
    }
    if (isLast) {
      setOnboardingComplete()
      onComplete?.()
      nav('/plan')
    } else {
      setScreen((s) => Math.min(s + 1, SCREENS.length - 1))
    }
  }

  function handleSkip() {
    setOnboardingComplete()
    onComplete?.()
    nav('/plan')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-sm text-center"
          >
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 mb-6">
              {current.icon ? (() => {
                const Icon = current.icon
                return <Icon className="h-8 w-8 text-white" />
              })() : null}
            </div>

            <h1 className="text-xl font-bold text-white leading-tight">{current.title}</h1>
            <p className="mt-3 text-sm text-white/60 leading-relaxed">{current.subtitle}</p>

            {current.features && (
              <div className="mt-8 space-y-3">
                {current.features.map((f, i) => {
                  const Icon = f.icon
                  return (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
                      <Icon className="h-4 w-4 text-violet-400" />
                    </div>
                    <span className="text-sm font-medium text-white">{f.label}</span>
                  </motion.div>
                  )
                })}
              </div>
            )}

            {current.steps && (
              <div className="mt-8 space-y-2">
                {current.steps.map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-4 py-2.5 text-left text-sm text-white/90"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                      {i + 1}
                    </span>
                    {step}
                  </motion.div>
                ))}
              </div>
            )}

            {(current as { nutritionForm?: boolean }).nutritionForm && (
              <div className="mt-8 text-left space-y-4">
                <div>
                  <Label>Daily calorie target</Label>
                  <Input
                    inputMode="numeric"
                    value={nutritionCalories}
                    onChange={(e) => setNutritionCalories(e.target.value)}
                    placeholder="2000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Macro split</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {MACRO_PRESETS.map((p, i) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setNutritionPreset(i)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          nutritionPreset === i
                            ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {p.label} ({p.goals.proteinPct}/{p.goals.carbsPct}/{p.goals.fatPct})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex flex-col items-center gap-3 w-full max-w-sm">
          <Button className="w-full" size="lg" onClick={handleNext}>
            {isLast ? current.cta : 'Next'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>

          {!isLast && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-white/40 hover:text-white/60 transition"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 pb-10">
        {SCREENS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setScreen(i)}
            className={`h-2 rounded-full transition-all ${
              i === screen ? 'w-6 bg-emerald-500' : 'w-2 bg-white/20 hover:bg-white/30'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
