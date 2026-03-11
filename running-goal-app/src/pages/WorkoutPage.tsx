import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Pause, Play, SkipBack, SkipForward, SquareCheck, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { pushWorkoutsToGarmin } from '../lib/garmin'
import { applyPushResults, toGarminPushInput } from '../lib/garminPush'
import { formatPaceWithSpeed } from '../lib/pace'
import { loadPlan, savePlan, updateWorkout } from '../lib/storage'
import { formatClock, formatDurationShort } from '../lib/time'
import { useWorkoutPlayer } from '../lib/useWorkoutPlayer'
import type { TrainingPlan, Workout, WorkoutType } from '../lib/types'

function getWorkoutAccent(type: WorkoutType): { bg: string; ring: string; glow: string } {
  switch (type) {
    case 'intervals':
      return {
        bg: 'from-violet-900/50 via-[#070b14] to-[#041a14]',
        ring: '#8b5cf6',
        glow: 'rgba(139,92,246,0.35)',
      }
    case 'tempo':
      return {
        bg: 'from-amber-900/40 via-[#070b14] to-[#041a14]',
        ring: '#f59e0b',
        glow: 'rgba(245,158,11,0.35)',
      }
    case 'long':
      return {
        bg: 'from-emerald-900/40 via-[#070b14] to-[#041a14]',
        ring: '#10b981',
        glow: 'rgba(16,185,129,0.35)',
      }
    case 'race':
      return {
        bg: 'from-sky-900/50 via-[#070b14] to-[#041a14]',
        ring: '#38bdf8',
        glow: 'rgba(56,189,248,0.35)',
      }
    default:
      return {
        bg: 'from-[#0d1528] via-[#070b14] to-[#041a14]',
        ring: '#10b981',
        glow: 'rgba(16,185,129,0.25)',
      }
  }
}

function StageDots({
  count,
  current,
}: {
  count: number
  current: number
}) {
  if (count <= 1) return null
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === current ? 18 : 6,
            height: 6,
            backgroundColor:
              i < current
                ? 'rgba(16,185,129,0.8)'
                : i === current
                  ? '#ffffff'
                  : 'rgba(255,255,255,0.15)',
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  )
}

function StageProgressRing({
  progress,
  color,
  glow,
  size = 240,
}: {
  progress: number
  color: string
  glow: string
  size?: number
}) {
  const r = size / 2 - 12
  const circ = 2 * Math.PI * r
  const filled = Math.min(1, Math.max(0, progress)) * circ

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      style={{ filter: `drop-shadow(0 0 12px ${glow})` }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="5"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        animate={{ strokeDasharray: `${filled} ${circ}` }}
        transition={{ duration: 0.4, ease: 'linear' }}
        style={{ strokeDasharray: `${filled} ${circ}` }}
      />
    </svg>
  )
}

export function WorkoutPage() {
  const nav = useNavigate()
  const params = useParams()
  const workoutId = params.id ?? ''
  const confettiFiredRef = useRef(false)

  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadPlan())
  const workout = useMemo<Workout | null>(() => {
    if (!plan) return null
    return plan.workouts.find((w) => w.id === workoutId) ?? null
  }, [plan, workoutId])

  const player = useWorkoutPlayer(workout)
  const [syncing, setSyncing] = useState(false)
  const completed = Boolean(workout?.completedAtISO)
  const accent = getWorkoutAccent(workout?.type ?? 'easy')

  function markComplete(): void {
    if (!plan || !workout) return
    const updated: Workout = { ...workout, completedAtISO: new Date().toISOString() }
    const nextPlan = updateWorkout(plan, updated)
    savePlan(nextPlan)
    setPlan(nextPlan)
  }

  async function syncWorkout(): Promise<void> {
    if (!plan || !workout || workout.type === 'rest') return
    setSyncing(true)
    const results = await pushWorkoutsToGarmin([toGarminPushInput(workout)])
    const [patched] = applyPushResults([workout], results)
    const nextPlan = updateWorkout(plan, patched)
    savePlan(nextPlan)
    setPlan(nextPlan)
    setSyncing(false)
  }

  useEffect(() => {
    if (player.status === 'finished' && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      markComplete()
      void confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.55 },
        colors: ['#10b981', '#8b5cf6', '#f59e0b', '#38bdf8', '#ffffff'],
        gravity: 0.9,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.status])

  if (!plan || !workout) {
    return (
      <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
        <TopBar
          title="Workout"
          right={
            <Button variant="ghost" onClick={() => nav(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          }
        />
        <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
          <Card className="p-4">
            <div className="text-base font-semibold text-white">Workout not found</div>
            <div className="mt-3">
              <Button onClick={() => nav('/calendar')}>Back to Calendar</Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className={`min-h-full bg-gradient-to-b ${accent.bg}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <TopBar
        title={workout.title}
        right={
          <Button variant="ghost" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4">

        {/* ── Player ── */}
        <Card className="overflow-hidden">
          <div className="relative flex flex-col items-center pt-8 pb-6 px-4 gap-5">

            {/* Completion badge */}
            <AnimatePresence>
              {completed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100"
                >
                  <SquareCheck className="h-3.5 w-3.5" /> Completed
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Stage label */}
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
                {workout.type !== 'rest' ? `Stage ${player.stageIndex + 1} of ${workout.stages.length}` : 'Rest Day'}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={player.stageIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 text-lg font-semibold text-white"
                >
                  {player.currentStage?.label ?? '—'}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress ring + countdown */}
            <div className="relative flex items-center justify-center">
              <StageProgressRing
                progress={player.progress}
                color={accent.ring}
                glow={accent.glow}
                size={232}
              />
              <div className="absolute flex flex-col items-center">
                <motion.div
                  key={player.remainingSec}
                  initial={{ scale: 1.04, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-[56px] font-bold tabular-nums tracking-tight text-white leading-none"
                >
                  {formatClock(player.remainingSec)}
                </motion.div>
                {player.currentStage?.targetPaceSecPerKm ? (
                  <div className="mt-1.5 text-xs font-medium text-white/50">
                    {formatPaceWithSpeed(player.currentStage.targetPaceSecPerKm)}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Stage dots */}
            <StageDots count={workout.stages.length} current={player.stageIndex} />

            {/* Next stage hint */}
            {player.nextStage ? (
              <div className="text-xs text-white/40">
                Next: <span className="text-white/60">{player.nextStage.label}</span>
              </div>
            ) : player.status === 'running' ? (
              <div className="text-xs text-white/40">Last stage</div>
            ) : null}

            {/* Controls */}
            <div className="grid grid-cols-3 gap-3 w-full">
              <Button
                variant="secondary"
                size="lg"
                onClick={player.back}
                disabled={player.stageIndex <= 0 || player.status === 'idle'}
                className="rounded-2xl"
              >
                <SkipBack className="h-5 w-5" />
              </Button>

              {player.status === 'running' ? (
                <Button variant="primary" size="lg" onClick={player.pause} className="rounded-2xl">
                  <Pause className="h-5 w-5" />
                </Button>
              ) : player.status === 'paused' ? (
                <Button variant="primary" size="lg" onClick={player.resume} className="rounded-2xl">
                  <Play className="h-5 w-5" />
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={player.start} className="rounded-2xl">
                  <Play className="h-5 w-5" />
                </Button>
              )}

              <Button
                variant="secondary"
                size="lg"
                onClick={player.skip}
                disabled={player.stageIndex >= workout.stages.length - 1 || player.status === 'idle'}
                className="rounded-2xl"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2 w-full">
              {!completed ? (
                <Button variant="ghost" className="flex-1" onClick={markComplete}>
                  <SquareCheck className="h-4 w-4" /> Mark complete
                </Button>
              ) : null}
              {workout.type !== 'rest' ? (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => void syncWorkout()}
                  disabled={syncing}
                >
                  <UploadCloud className="h-4 w-4" />
                  {syncing ? 'Syncing...' : 'Send to Garmin'}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* ── Meta info ── */}
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <div className="text-xs text-white/50">{workout.dateISO}</div>
              <div className="text-white/80">{formatDurationShort(workout.totalDurationSec)}</div>
              {typeof workout.plannedDistanceKm === 'number' ? (
                <div className="text-sm text-white/60">{workout.plannedDistanceKm} km planned</div>
              ) : null}
            </div>
            {workout.garminDistanceKm != null ? (
              <div className="text-sm text-emerald-200">
                Garmin: {workout.garminDistanceKm.toFixed(2)} km ·{' '}
                {formatClock(workout.garminDurationSec ?? 0)}
                {workout.garminAvgPaceSecPerKm
                  ? ` · ${formatPaceWithSpeed(workout.garminAvgPaceSecPerKm)}`
                  : ''}
              </div>
            ) : null}
            {workout.garminSyncStatus ? (
              <div
                className={`text-xs ${
                  workout.garminSyncStatus === 'synced'
                    ? 'text-emerald-200'
                    : workout.garminSyncStatus === 'failed'
                      ? 'text-red-200'
                      : 'text-amber-100'
                }`}
              >
                Garmin: {workout.garminSyncStatus}
                {workout.garminSyncMessage ? ` — ${workout.garminSyncMessage}` : ''}
              </div>
            ) : null}
          </div>
        </Card>

        {/* ── Stages list ── */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-white mb-3">Stages</div>
          <div className="grid gap-2">
            {workout.stages.map((s, idx) => {
              const active = idx === player.stageIndex
              const done = idx < player.stageIndex
              return (
                <motion.button
                  key={s.id}
                  onClick={() => player.setStage(idx)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    active
                      ? 'border-emerald-400/40 bg-emerald-500/10'
                      : done
                        ? 'border-white/8 bg-white/3'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className={`text-sm ${active ? 'text-white font-medium' : done ? 'text-white/40' : 'text-white/90'}`}
                      >
                        {s.label}
                      </div>
                      <div className="mt-0.5 text-xs text-white/50">
                        {formatDurationShort(s.durationSec)}
                        {s.targetPaceSecPerKm
                          ? ` · ${formatPaceWithSpeed(s.targetPaceSecPerKm)}`
                          : ''}
                      </div>
                    </div>
                    <div
                      className={`text-xs ${active ? 'text-emerald-400 font-semibold' : done ? 'text-emerald-400/50' : 'text-white/30'}`}
                    >
                      {done ? '✓' : `#${idx + 1}`}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </Card>
      </div>
    </motion.div>
  )
}
