import type { WorkoutStage, WorkoutStageKind } from './types'

const STAGE_NAMES: Record<WorkoutStageKind, string> = {
  warmup: 'Warm up',
  easy: 'Easy run',
  tempo: 'Tempo',
  interval: 'Interval',
  recovery: 'Recovery',
  cooldown: 'Cooldown',
  race: 'Race effort',
  rest: 'Rest',
}

function formatDurationForSpeech(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts: string[] = []
  if (h > 0) parts.push(h === 1 ? '1 hour' : `${h} hours`)
  if (m > 0) parts.push(m === 1 ? '1 minute' : `${m} minutes`)
  if (sec > 0 && h === 0 && m === 0) parts.push(sec === 1 ? '1 second' : `${sec} seconds`)
  else if (sec > 0) parts.push(sec === 1 ? '1 second' : `${sec} seconds`)
  return parts.length > 0 ? parts.join(' ') : 'a few seconds'
}

function formatPaceForSpeech(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  if (s === 0) return m === 1 ? '1 minute per kilometer' : `${m} minutes per kilometer`
  return `${m} minutes ${s} seconds per kilometer`
}

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function speak(text: string): void {
  if (!isVoiceSupported() || !text.trim()) return
  cancelSpeech()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.pitch = 1
  u.volume = 1
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}

export function speakStage(stage: WorkoutStage, index: number, total: number): void {
  const name = STAGE_NAMES[stage.kind] ?? stage.label ?? 'Next'
  const duration = formatDurationForSpeech(stage.durationSec)
  const parts: string[] = [`${name}. ${duration}`]
  if (stage.targetPaceSecPerKm && stage.targetPaceSecPerKm > 0) {
    parts.push(`at ${formatPaceForSpeech(stage.targetPaceSecPerKm)}`)
  }
  if (total > 1) {
    parts.push(`Step ${index + 1} of ${total}`)
  }
  speak(parts.join('. '))
}

export function speakWorkoutComplete(): void {
  speak('Workout complete. Great job.')
}

export function speakSecondsRemaining(seconds: number): void {
  if (seconds <= 0) return
  const s = Math.floor(seconds)
  speak(s === 1 ? '1 second left' : `${s} seconds left`)
}
