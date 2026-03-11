import { format, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { CalendarDays, ChevronRight, Dumbbell, Flame, Lightbulb, Timer, TrendingUp, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { WeeklyRing, WeeklyRingLegend } from '../components/WeeklyRing'
import { getTodaysLog, loadNutritionGoals, type NutritionLogEntry } from '../lib/nutrition'
import { computeProgress } from '../lib/progress'
import { loadActivePlan, loadPlans } from '../lib/storage'
import { computeBadges } from '../lib/badges'
import { computeCurrentWeek, computeStreak, getDailyTip } from '../lib/stats'
import type { TrainingPlan, Workout } from '../lib/types'
import { formatDurationShort } from '../lib/time'
import { supabase } from '../lib/supabase'

function todayISO(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd')
}

function nextWorkoutFromPlan(plan: TrainingPlan | null): Workout | null {
  if (!plan) return null
  const t = todayISO()
  return plan.workouts.find((w) => w.dateISO >= t && w.type !== 'rest') ?? null
}

function AnimatedBar({
  pct,
  from,
  to,
  delay = 0.2,
}: {
  pct: number
  from: string
  to: string
  delay?: number
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${from} ${to}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 0.9, ease: 'easeOut', delay }}
      />
    </div>
  )
}

function ProgressBar({
  label,
  value,
  pct,
  from,
  to,
}: {
  label: string
  value: string
  pct: number
  from: string
  to: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className="font-medium text-white/70">{value}</span>
      </div>
      <div className="mt-1">
        <AnimatedBar pct={pct} from={from} to={to} />
      </div>
    </div>
  )
}

function MacroPill({
  label,
  consumed,
  goal,
  color,
}: {
  label: string
  consumed: number
  goal: number
  color: string
}) {
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[11px] text-white/50 mb-1">
        <span>{label}</span>
        <span>{consumed}g</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.35 }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-white/30 text-right">/ {goal}g</div>
    </div>
  )
}

function WeeklyBarChart({ plan }: { plan: TrainingPlan }) {
  const days = useMemo(() => computeCurrentWeek(plan), [plan])
  const maxKm = Math.max(...days.map((d) => d.plannedKm), 1)
  const BAR_H = 44

  return (
    <div className="flex items-end justify-between gap-1 px-0.5" style={{ height: BAR_H + 20 }}>
      {days.map((d, i) => {
        const plannedH = (d.plannedKm / maxKm) * BAR_H
        const completedH = (d.completedKm / maxKm) * BAR_H

        let barColor = 'bg-white/15'
        if (d.workoutType === 'intervals') barColor = 'bg-violet-500/50'
        else if (d.workoutType === 'tempo') barColor = 'bg-amber-500/50'
        else if (d.workoutType === 'long') barColor = 'bg-emerald-500/50'
        else if (d.workoutType === 'race') barColor = 'bg-sky-500/50'
        else if (d.workoutType === 'easy') barColor = 'bg-emerald-400/40'

        return (
          <div key={d.dateISO} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="relative w-full rounded-sm overflow-hidden"
              style={{ height: BAR_H, display: 'flex', alignItems: 'flex-end' }}
            >
              {/* Planned bar (background) */}
              {plannedH > 0 && (
                <motion.div
                  className={`absolute bottom-0 w-full rounded-sm ${barColor}`}
                  initial={{ height: 0 }}
                  animate={{ height: plannedH }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + i * 0.06 }}
                />
              )}
              {/* Completed bar (foreground) */}
              {completedH > 0 && (
                <motion.div
                  className="absolute bottom-0 w-full rounded-sm bg-emerald-400"
                  initial={{ height: 0 }}
                  animate={{ height: completedH }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 + i * 0.06 }}
                />
              )}
            </div>
            <div
              className={`text-[10px] font-medium ${d.isToday ? 'text-emerald-400' : 'text-white/30'}`}
            >
              {d.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BadgeChip({ badge }: { badge: ReturnType<typeof computeBadges>[number] }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
        badge.earned
          ? 'border border-violet-400/30 bg-violet-500/15 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
          : 'border border-white/8 bg-white/5 text-white/30'
      }`}
    >
      <span className={badge.earned ? '' : 'grayscale opacity-40'}>{badge.emoji}</span>
      {badge.name}
    </div>
  )
}

const stagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export function HomePage() {
  const nav = useNavigate()
  const [plan] = useState<TrainingPlan | null>(() => loadActivePlan())
  const [plans] = useState<TrainingPlan[]>(() => loadPlans())
  const [todayLog, setTodayLog] = useState<NutritionLogEntry[]>([])
  const goals = useMemo(() => loadNutritionGoals(), [])

  useEffect(() => {
    let mounted = true
    supabase?.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      if (!uid || !mounted) return
      void getTodaysLog(uid).then((log) => {
        if (mounted) setTodayLog(log)
      })
    })
    return () => {
      mounted = false
    }
  }, [])

  const nextWorkout = useMemo(() => nextWorkoutFromPlan(plan), [plan])
  const progress = useMemo(() => (plan ? computeProgress(plan, new Date()) : null), [plan])
  const streak = useMemo(() => (plan ? computeStreak(plan.workouts) : 0), [plan])
  const badges = useMemo(() => computeBadges(plan, plan?.workouts ?? []), [plan])
  const dailyTip = useMemo(() => getDailyTip(), [])

  const weekWorkoutsCompleted = useMemo(() => {
    if (!plan) return 0
    const week = computeCurrentWeek(plan)
    return week.filter((d) => d.completedKm > 0).length
  }, [plan])

  const weekKmCompleted = useMemo(() => {
    if (!plan) return 0
    return computeCurrentWeek(plan).reduce((s, d) => s + d.completedKm, 0)
  }, [plan])

  const weekKmPlanned = useMemo(() => {
    if (!plan) return 0
    return computeCurrentWeek(plan).reduce((s, d) => s + d.plannedKm, 0)
  }, [plan])

  const weekDaysTarget = useMemo(() => {
    if (!plan) return 4
    const week = computeCurrentWeek(plan)
    return week.filter((d) => d.plannedKm > 0).length || 4
  }, [plan])

  const totalCalories = todayLog.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalProtein = Math.round(todayLog.reduce((s, e) => s + (e.protein ?? 0), 0))
  const totalCarbs = Math.round(todayLog.reduce((s, e) => s + (e.carbs ?? 0), 0))
  const totalFat = Math.round(todayLog.reduce((s, e) => s + (e.fat ?? 0), 0))

  const proteinGoalG = Math.round((goals.calories * goals.proteinPct) / 100 / 4)
  const carbsGoalG = Math.round((goals.calories * goals.carbsPct) / 100 / 4)
  const fatGoalG = Math.round((goals.calories * goals.fatPct) / 100 / 9)

  const caloriePct = goals.calories > 0 ? Math.min(100, (totalCalories / goals.calories) * 100) : 0
  const raceDaysLeft = plan ? (progress?.raceDaysLeft ?? null) : null
  const earnedBadges = badges.filter((b) => b.earned)

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Dashboard" />

      <motion.div
        className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >

        {/* ── Active plan ── */}
        <motion.div variants={fadeUp}>
          {plan ? (
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-violet-400">Active plan</div>
                    <div className="mt-0.5 truncate text-lg font-bold text-white">
                      {plan.planName ?? `Plan ${plan.raceDateISO}`}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {raceDaysLeft !== null ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">
                          <Flame className="h-3 w-3" /> {raceDaysLeft} days to race
                        </div>
                      ) : null}
                      {streak > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                          🔥 {streak} day{streak !== 1 ? 's' : ''} streak
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Button variant="ghost" size="md" onClick={() => nav('/calendar')}>
                    <CalendarDays className="h-4 w-4" /> Calendar
                  </Button>
                </div>

                {progress ? (
                  <div className="mt-4 space-y-2.5">
                    <ProgressBar
                      label="Workouts"
                      value={`${progress.completedCount} / ${progress.totalCount}`}
                      pct={progress.completionPct}
                      from="from-emerald-400"
                      to="to-violet-500"
                    />
                    <ProgressBar
                      label="Distance"
                      value={`${progress.completedKmToDate.toFixed(1)} / ${progress.plannedKmToDate.toFixed(1)} km`}
                      pct={
                        progress.plannedKmToDate > 0
                          ? (progress.completedKmToDate / progress.plannedKmToDate) * 100
                          : 0
                      }
                      from="from-sky-400"
                      to="to-emerald-400"
                    />
                    <ProgressBar
                      label="Plan timeline"
                      value={`${Math.round(progress.racePct * 100)}% through`}
                      pct={Math.round(progress.racePct * 100)}
                      from="from-amber-400"
                      to="to-rose-500"
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">No active plan</div>
                  <div className="mt-0.5 text-xs text-white/40">Generate an AI training plan to get started.</div>
                </div>
                <Button variant="primary" size="md" onClick={() => nav('/plan')}>
                  <Dumbbell className="h-4 w-4" /> Create plan
                </Button>
              </div>
            </Card>
          )}
        </motion.div>

        {/* ── Weekly rings + volume chart ── */}
        {plan ? (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
                This Week
              </div>
              <div className="flex items-center gap-4">
                <WeeklyRing
                  moveValue={weekWorkoutsCompleted}
                  moveMax={weekDaysTarget}
                  distanceValue={Math.round(weekKmCompleted * 10) / 10}
                  distanceMax={Math.max(weekKmPlanned, 1)}
                  streakValue={streak}
                  streakMax={7}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <WeeklyRingLegend
                    items={[
                      {
                        color: '#10b981',
                        label: 'Workouts',
                        value: `${weekWorkoutsCompleted}/${weekDaysTarget}`,
                      },
                      {
                        color: '#38bdf8',
                        label: 'Distance',
                        value: `${weekKmCompleted.toFixed(1)} km`,
                      },
                      {
                        color: '#8b5cf6',
                        label: 'Streak',
                        value: `${streak} day${streak !== 1 ? 's' : ''}`,
                      },
                    ]}
                  />
                  <WeeklyBarChart plan={plan} />
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* ── Next workout ── */}
        {nextWorkout ? (
          <motion.div variants={fadeUp}>
            <button
              type="button"
              onClick={() => nav(`/workout/${nextWorkout.id}`)}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3 p-4 transition hover:bg-white/[0.07]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-violet-500">
                  <Timer className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-emerald-400">Next workout</div>
                  <div className="truncate font-semibold text-white">{nextWorkout.title}</div>
                  <div className="text-xs text-white/50">
                    {nextWorkout.dateISO} &middot; {formatDurationShort(nextWorkout.totalDurationSec)}
                    {nextWorkout.plannedDistanceKm ? ` · ${nextWorkout.plannedDistanceKm} km` : ''}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
              </Card>
            </button>
          </motion.div>
        ) : plan ? (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="text-sm text-white/50">No upcoming workouts — enjoy the rest day!</div>
            </Card>
          </motion.div>
        ) : null}

        {/* ── Nutrition today ── */}
        <motion.div variants={fadeUp}>
          <button type="button" onClick={() => nav('/nutrition')} className="w-full text-left">
            <Card className="p-4 transition hover:bg-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">Today's nutrition</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{totalCalories}</span>
                  <span className="text-xs text-white/40">/ {goals.calories} cal</span>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </div>
              </div>

              <div className="mt-3">
                <AnimatedBar pct={caloriePct} from="from-amber-400" to="to-rose-500" delay={0.4} />
              </div>

              <div className="mt-3 flex gap-3">
                <MacroPill label="Protein" consumed={totalProtein} goal={proteinGoalG} color="bg-sky-400" />
                <MacroPill label="Carbs" consumed={totalCarbs} goal={carbsGoalG} color="bg-emerald-400" />
                <MacroPill label="Fat" consumed={totalFat} goal={fatGoalG} color="bg-amber-400" />
              </div>

              {todayLog.length === 0 ? (
                <div className="mt-2 text-xs text-white/30">No entries yet — tap to log food.</div>
              ) : (
                <div className="mt-2 text-xs text-white/30">
                  {todayLog.length} item{todayLog.length !== 1 ? 's' : ''} logged today
                </div>
              )}
            </Card>
          </button>
        </motion.div>

        {/* ── Achievements ── */}
        {earnedBadges.length > 0 || plan ? (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
                Achievements
              </div>
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} />
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* ── Coach tip ── */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            <div className="flex gap-3 p-4" style={{ borderLeft: '3px solid rgba(139,92,246,0.5)' }}>
              <Lightbulb className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-400 mb-1">
                  Coach tip
                </div>
                <div className="text-sm text-white/70 leading-relaxed">{dailyTip}</div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── All plans summary ── */}
        {plans.length > 1 ? (
          <motion.div variants={fadeUp}>
            <button type="button" onClick={() => nav('/plan')} className="w-full text-left">
              <Card className="flex items-center gap-3 p-4 transition hover:bg-white/[0.07]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <TrendingUp className="h-5 w-5 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">Your plans</div>
                  <div className="text-xs text-white/40">{plans.length} plans saved</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </Card>
            </button>
          </motion.div>
        ) : null}
      </motion.div>
    </div>
  )
}
