import { useEffect, useMemo, useRef, useState } from 'react'
import type { Workout } from './types'
import { speakStage, speakWorkoutComplete } from './voiceCues'

type Status = 'idle' | 'running' | 'paused' | 'finished'

type Options = { voiceEnabled?: boolean }

type AudioEngine = {
  ctx: AudioContext
}

function beep(engine: AudioEngine, frequency = 880, durationMs = 120): void {
  const o = engine.ctx.createOscillator()
  const g = engine.ctx.createGain()
  o.type = 'sine'
  o.frequency.value = frequency
  g.gain.value = 0.0001
  o.connect(g)
  g.connect(engine.ctx.destination)
  const t0 = engine.ctx.currentTime
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(0.05, t0 + 0.01)
  g.gain.linearRampToValueAtTime(0.0001, t0 + durationMs / 1000)
  o.start()
  o.stop(t0 + durationMs / 1000 + 0.02)
}

export function useWorkoutPlayer(workout: Workout | null, options?: Options) {
  const voiceEnabled = options?.voiceEnabled ?? false
  const voiceEnabledRef = useRef(voiceEnabled)
  voiceEnabledRef.current = voiceEnabled

  const stages = workout?.stages ?? []

  const [status, setStatus] = useState<Status>('idle')
  const [stageIndex, setStageIndex] = useState(0)
  const [remainingSec, setRemainingSec] = useState(stages[0]?.durationSec ?? 0)

  const engineRef = useRef<AudioEngine | null>(null)
  const tickRef = useRef<number | null>(null)
  const stageStartMsRef = useRef<number | null>(null)
  const stageDurationSecRef = useRef<number>(stages[0]?.durationSec ?? 0)

  const currentStage = stages[stageIndex] ?? null
  const nextStage = stages[stageIndex + 1] ?? null

  const progress = useMemo(() => {
    const total = currentStage?.durationSec ?? 0
    if (!total) return 0
    return Math.min(1, Math.max(0, 1 - remainingSec / total))
  }, [currentStage?.durationSec, remainingSec])

  function primeAudio(): void {
    if (engineRef.current) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    engineRef.current = { ctx: new Ctx() }
  }

  function stopTicker(): void {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  function startTicker(): void {
    stopTicker()
    tickRef.current = window.setInterval(() => {
      const stageStartMs = stageStartMsRef.current
      if (!stageStartMs) return
      const elapsedSec = Math.floor((Date.now() - stageStartMs) / 1000)
      const left = Math.max(0, stageDurationSecRef.current - elapsedSec)
      setRemainingSec(left)

      if (left <= 0) {
        advance()
      }
    }, 250)
  }

  function setStage(idx: number): void {
    const clamped = Math.max(0, Math.min(idx, Math.max(0, stages.length - 1)))
    setStageIndex(clamped)
    const dur = stages[clamped]?.durationSec ?? 0
    stageDurationSecRef.current = dur
    stageStartMsRef.current = Date.now()
    setRemainingSec(dur)
    if (voiceEnabledRef.current && (status === 'running' || status === 'paused')) {
      const s = stages[clamped]
      if (s) speakStage(s, clamped, stages.length)
    }
  }

  function start(): void {
    if (!workout || stages.length === 0) return
    primeAudio()
    if (engineRef.current) {
      void engineRef.current.ctx.resume?.()
      beep(engineRef.current, 740, 90)
    }
    setStatus('running')
    stageStartMsRef.current = Date.now()
    stageDurationSecRef.current = stages[stageIndex]?.durationSec ?? 0
    startTicker()
    if (voiceEnabledRef.current && stages[0]) speakStage(stages[0], 0, stages.length)
  }

  function pause(): void {
    if (status !== 'running') return
    setStatus('paused')
    stopTicker()
  }

  function resume(): void {
    if (status !== 'paused') return
    setStatus('running')
    // resume by treating "now" as stage start minus elapsed
    const dur = stageDurationSecRef.current
    const alreadyElapsed = dur - remainingSec
    stageStartMsRef.current = Date.now() - alreadyElapsed * 1000
    startTicker()
  }

  function advance(): void {
    const nextIdx = stageIndex + 1
    if (nextIdx >= stages.length) {
      setStatus('finished')
      stopTicker()
      setRemainingSec(0)
      if (voiceEnabledRef.current) speakWorkoutComplete()
      if (engineRef.current) {
        beep(engineRef.current, 988, 110)
        setTimeout(() => engineRef.current && beep(engineRef.current, 740, 110), 160)
      }
      return
    }
    setStage(nextIdx)
    if (engineRef.current) beep(engineRef.current, 880, 80)
  }

  function back(): void {
    if (stages.length === 0) return
    setStage(stageIndex - 1)
    if (engineRef.current) beep(engineRef.current, 520, 80)
  }

  function skip(): void {
    if (stages.length === 0) return
    setStage(stageIndex + 1)
    if (engineRef.current) beep(engineRef.current, 880, 80)
  }

  function reset(): void {
    stopTicker()
    setStatus('idle')
    setStageIndex(0)
    const dur = stages[0]?.durationSec ?? 0
    stageDurationSecRef.current = dur
    stageStartMsRef.current = null
    setRemainingSec(dur)
  }

  useEffect(() => {
    // when workout changes
    stopTicker()
    setStatus('idle')
    setStageIndex(0)
    const dur = stages[0]?.durationSec ?? 0
    stageDurationSecRef.current = dur
    stageStartMsRef.current = null
    setRemainingSec(dur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout?.id])

  useEffect(() => () => stopTicker(), [])

  return {
    status,
    stageIndex,
    currentStage,
    nextStage,
    remainingSec,
    progress,
    primeAudio,
    start,
    pause,
    resume,
    back,
    skip,
    reset,
    setStage,
  }
}

