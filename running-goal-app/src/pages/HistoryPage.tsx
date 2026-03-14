import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import { BarChart3, ChevronRight, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { loadActivePlan } from '../lib/storage'
import { computeProgress } from '../lib/progress'
import { computeStreak } from '../lib/stats'
import { formatPace } from '../lib/pace'
import type { Workout } from '../lib/types'

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

export function HistoryPage() {
  const nav = useNavigate()
  const plan = loadActivePlan()
  const progress = useMemo(() => (plan ? computeProgress(plan) : null), [plan])
  const streak = useMemo(() => (plan ? computeStreak(plan.workouts) : 0), [plan])

  const completedWithPace = useMemo(() => {
    if (!plan) return []
    return plan.workouts
      .filter((w) => w.completedAtISO && w.type !== 'rest')
      .map((w) => {
        const pace = w.stravaAvgPaceSecPerKm ?? w.garminAvgPaceSecPerKm
        const km = w.stravaDistanceKm ?? w.garminDistanceKm ?? w.plannedDistanceKm ?? 0
        return { ...w, pace, km }
      })
      .filter((w) => (w.pace ?? 0) > 0)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .slice(-20)
  }, [plan])

  const avgPace = useMemo(() => {
    if (completedWithPace.length === 0) return null
    const sum = completedWithPace.reduce((s, w) => s + (w.pace ?? 0), 0)
    return sum / completedWithPace.length
  }, [completedWithPace])

  const totalKm = useMemo(() => {
    return completedWithPace.reduce((s, w) => s + (w.km ?? 0), 0)
  }, [completedWithPace])

  if (!plan) {
    return (
      <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
        <TopBar title="Progress" />
        <div className="safe-area-px mx-auto max-w-md px-4 pb-28 pt-5">
          <Card className="p-4">
            <p className="text-white/70">Create a plan to see your progress.</p>
            <Button className="mt-3" onClick={() => nav('/plan')}>
              Create plan
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Progress" />
      <motion.div
        className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4"
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="h-6 w-6 text-violet-400" />
              <div>
                <div className="text-lg font-bold text-white">Overview</div>
                <div className="text-xs text-white/50">Your training consistency</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-white">{streak}</div>
                <div className="text-[10px] text-white/50 uppercase">Day streak</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {progress ? `${progress.completionPct}%` : '-'}
                </div>
                <div className="text-[10px] text-white/50 uppercase">Completion</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-white">{totalKm.toFixed(1)}</div>
                <div className="text-[10px] text-white/50 uppercase">km logged</div>
              </div>
            </div>
          </Card>
        </motion.div>

        {progress && progress.weeklyKm.length > 0 && (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <div className="text-base font-bold text-white">Weekly distance</div>
              </div>
              <div className="flex items-end gap-1 h-24">
                {progress.weeklyKm.map((w) => (
                  <div key={w.key} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400 min-h-[4px]"
                      initial={{ height: 0 }}
                      animate={{
                        height: `${progress!.maxWeeklyKm > 0 ? (w.km / progress!.maxWeeklyKm) * 80 : 0}px`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                    <span className="text-[9px] text-white/40 truncate max-w-full">
                      {format(parseISO(w.key), 'd')}
                    </span>
                    <span className="text-[10px] font-medium text-white/80">{w.km} km</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {avgPace && (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="text-base font-bold text-white mb-2">Average pace</div>
              <div className="text-2xl font-bold text-emerald-400">{formatPace(avgPace)}</div>
              <p className="text-xs text-white/50 mt-1">
                From {completedWithPace.length} run{completedWithPace.length !== 1 ? 's' : ''} with
                pace data
              </p>
            </Card>
          </motion.div>
        )}

        {completedWithPace.length > 0 && (
          <motion.div variants={fadeUp}>
            <Card className="p-4">
              <div className="text-base font-bold text-white mb-3">Recent runs</div>
              <div className="space-y-2">
                {[...completedWithPace].reverse().slice(0, 5).map((w: Workout & { pace?: number; km?: number }) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {format(parseISO(w.dateISO), 'EEE, MMM d')}
                      </div>
                      <div className="text-xs text-white/50">
                        {w.type} · {(w.km ?? 0).toFixed(1)} km
                      </div>
                    </div>
                    {w.pace ? (
                      <span className="text-sm font-medium text-emerald-400">{formatPace(w.pace)}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <Button variant="secondary" className="w-full" onClick={() => nav('/')}>
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Dashboard
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
