import { useMemo } from 'react'
import type { WheelOption } from './WheelColumn'
import { WheelColumn } from './WheelColumn'

const MIN_PACE_MIN = 2
const MAX_PACE_MIN = 12

type PaceWheelPickerProps = {
  value: string // "min:sec" or ""
  onChange: (value: string) => void
}

function parsePaceValue(value: string): { minutes: string; seconds: string } {
  if (!value.trim()) return { minutes: '', seconds: '00' }
  const parts = value.split(':')
  if (parts.length === 2) {
    const min = String(Math.min(MAX_PACE_MIN, Math.max(MIN_PACE_MIN, parseInt(parts[0], 10) || MIN_PACE_MIN)))
    const sec = String(Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0)))
    return { minutes: min, seconds: sec.padStart(2, '0') }
  }
  return { minutes: String(MIN_PACE_MIN), seconds: '00' }
}

const MINUTES_OPTIONS: WheelOption[] = [
  { value: '', label: '—' },
  ...Array.from({ length: MAX_PACE_MIN - MIN_PACE_MIN + 1 }, (_, i) => {
    const m = MIN_PACE_MIN + i
    return { value: String(m), label: String(m) }
  }),
]

const SECONDS_OPTIONS: WheelOption[] = Array.from({ length: 60 }, (_, i) => {
  const s = String(i).padStart(2, '0')
  return { value: s, label: s }
})

export function PaceWheelPicker({ value, onChange }: PaceWheelPickerProps) {
  const { minutes, seconds } = useMemo(() => parsePaceValue(value), [value])

  const handleMinutesChange = (m: string) => {
    if (m === '') {
      onChange('')
      return
    }
    const sec = seconds.padStart(2, '0')
    onChange(`${m}:${sec}`)
  }

  const handleSecondsChange = (s: string) => {
    const sec = s.padStart(2, '0')
    if (minutes === '') {
      onChange('')
      return
    }
    onChange(`${minutes}:${sec}`)
  }

  return (
    <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-2">
      <WheelColumn
        options={MINUTES_OPTIONS}
        value={minutes}
        onChange={handleMinutesChange}
        aria-label="pace minutes"
      />
      <span className="flex items-center text-white/50 text-lg font-medium shrink-0">:</span>
      <WheelColumn
        options={SECONDS_OPTIONS}
        value={seconds}
        onChange={handleSecondsChange}
        aria-label="pace seconds"
      />
      <span className="flex items-center text-white/50 text-sm font-medium shrink-0">/km</span>
    </div>
  )
}
