import type { WheelOption } from './WheelColumn'
import { WheelColumn } from './WheelColumn'

export type DurationValue = { hours: string; minutes: string; seconds: string }

type DurationWheelPickerProps = {
  hours: string
  minutes: string
  seconds: string
  onChange: (value: DurationValue) => void
  maxHours?: number
}

function buildHoursOptions(maxHours: number): WheelOption[] {
  return Array.from({ length: maxHours + 1 }, (_, i) => ({ value: String(i), label: String(i) }))
}

function buildMinutesOrSecondsOptions(): WheelOption[] {
  return Array.from({ length: 60 }, (_, i) => ({
    value: String(i),
    label: String(i).padStart(2, '0'),
  }))
}

export function DurationWheelPicker({
  hours,
  minutes,
  seconds,
  onChange,
  maxHours = 6,
}: DurationWheelPickerProps) {
  const hoursOptions = buildHoursOptions(maxHours)
  const minutesOptions = buildMinutesOrSecondsOptions()
  const secondsOptions = buildMinutesOrSecondsOptions()

  return (
    <div className="flex w-fit max-w-full gap-1 rounded-xl border border-white/10 bg-black/30 p-1.5">
      <WheelColumn
        options={hoursOptions}
        value={hours}
        onChange={(h) => onChange({ hours: h, minutes, seconds })}
        aria-label="hours"
      />
      <span className="flex items-center text-white/50 text-lg font-medium shrink-0">h</span>
      <WheelColumn
        options={minutesOptions}
        value={minutes}
        onChange={(m) => onChange({ hours, minutes: m, seconds })}
        aria-label="minutes"
      />
      <span className="flex items-center text-white/50 text-lg font-medium shrink-0">m</span>
      <WheelColumn
        options={secondsOptions}
        value={seconds}
        onChange={(s) => onChange({ hours, minutes, seconds: s })}
        aria-label="seconds"
      />
      <span className="flex items-center text-white/50 text-lg font-medium shrink-0">s</span>
    </div>
  )
}
