import { ArrowLeft, Pause, Play, SkipBack, SkipForward, SquareCheck, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { pushWorkoutsToGarmin } from '../lib/garmin'
import { applyPushResults, toGarminPushInput } from '../lib/garminPush'
import { formatPace } from '../lib/pace'
import { loadPlan, savePlan, updateWorkout } from '../lib/storage'
import { formatClock, formatDurationShort } from '../lib/time'
import { useWorkoutPlayer } from '../lib/useWorkoutPlayer'
import type { TrainingPlan, Workout } from '../lib/types'

export function WorkoutPage() {
  const nav = useNavigate()
  const params = useParams()
  const workoutId = params.id ?? ''

  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadPlan())
  const workout = useMemo<Workout | null>(() => {
    if (!plan) return null
    return plan.workouts.find((w) => w.id === workoutId) ?? null
  }, [plan, workoutId])

  const player = useWorkoutPlayer(workout)
  const [syncing, setSyncing] = useState(false)

  const completed = Boolean(workout?.completedAtISO)

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
    if (player.status === 'finished' && !completed) {
      markComplete()
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
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar
        title={workout.title}
        right={
          <Button variant="ghost" onClick={() => nav(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-white/60">{workout.dateISO}</div>
              <div className="mt-1 text-white/80">{formatDurationShort(workout.totalDurationSec)}</div>
              {typeof workout.plannedDistanceKm === 'number' ? (
                <div className="mt-1 text-sm text-white/60">{workout.plannedDistanceKm}km planned</div>
              ) : null}
              {typeof workout.garminDistanceKm === 'number' ? (
                <div className="mt-1 text-sm text-emerald-200">
                  Garmin: {workout.garminDistanceKm.toFixed(2)}km •{' '}
                  {formatClock(workout.garminDurationSec ?? 0)} •{' '}
                  {workout.garminAvgPaceSecPerKm
                    ? formatPace(workout.garminAvgPaceSecPerKm)
                    : null}
                </div>
              ) : null}
              {workout.garminSyncStatus ? (
                <div
                  className={`mt-1 text-xs ${
                    workout.garminSyncStatus === 'synced'
                      ? 'text-emerald-200'
                      : workout.garminSyncStatus === 'failed'
                        ? 'text-red-200'
                        : 'text-amber-100'
                  }`}
                >
                  Garmin sync: {workout.garminSyncStatus}
                  {workout.garminSyncMessage ? ` - ${workout.garminSyncMessage}` : ''}
                </div>
              ) : null}
            </div>

            {completed ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100">
                <SquareCheck className="h-4 w-4" />
                Completed
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Now</div>
            <div className="mt-1 text-lg font-semibold text-white">{player.currentStage?.label ?? '—'}</div>
            <div className="mt-3 text-center text-6xl font-semibold tracking-tight text-white">
              {formatClock(player.remainingSec)}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/60">
              {player.currentStage?.targetPaceSecPerKm ? (
                <span>Target {formatPace(player.currentStage.targetPaceSecPerKm)}</span>
              ) : (
                <span>Follow the prompt</span>
              )}
              {player.nextStage ? <span>• Next: {player.nextStage.label}</span> : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                onClick={player.back}
                disabled={player.stageIndex <= 0 || player.status === 'idle'}
              >
                <SkipBack className="h-4 w-4" /> Back
              </Button>

              {player.status === 'running' ? (
                <Button variant="primary" onClick={player.pause}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              ) : player.status === 'paused' ? (
                <Button variant="primary" onClick={player.resume}>
                  <Play className="h-4 w-4" /> Resume
                </Button>
              ) : (
                <Button variant="primary" onClick={player.start}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}

              <Button
                variant="secondary"
                onClick={player.skip}
                disabled={player.stageIndex >= workout.stages.length - 1 || player.status === 'idle'}
              >
                Next <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {!completed ? (
              <div className="mt-3">
                <Button variant="ghost" className="w-full" onClick={markComplete}>
                  <SquareCheck className="h-4 w-4" /> Mark workout complete
                </Button>
              </div>
            ) : null}
            {workout.type !== 'rest' ? (
              <div className="mt-2">
                <Button variant="secondary" className="w-full" onClick={() => void syncWorkout()} disabled={syncing}>
                  <UploadCloud className="h-4 w-4" /> {syncing ? 'Sending to Garmin...' : 'Send to Garmin'}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-sm font-semibold text-white">Stages</div>
          <div className="mt-3 grid gap-2">
            {workout.stages.map((s, idx) => {
              const active = idx === player.stageIndex
              return (
                <button
                  key={s.id}
                  onClick={() => player.setStage(idx)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    active ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={active ? 'text-white' : 'text-white/90'}>{s.label}</div>
                      <div className="mt-0.5 text-xs text-white/60">
                        {formatDurationShort(s.durationSec)}
                        {s.targetPaceSecPerKm ? ` • ${formatPace(s.targetPaceSecPerKm)}` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-white/50">#{idx + 1}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

