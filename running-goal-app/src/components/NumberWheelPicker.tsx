import { useMemo } from 'react'
import type { WheelOption } from './WheelColumn'
import { WheelColumn } from './WheelColumn'

type NumberWheelPickerProps = {
  min: number
  max: number
  step?: number
  value: string
  onChange: (value: string) => void
  suffix?: string
  allowEmpty?: boolean
}

export function NumberWheelPicker({
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix = '',
  allowEmpty = false,
}: NumberWheelPickerProps) {
  const options = useMemo((): WheelOption[] => {
    const list: WheelOption[] = []
    if (allowEmpty) list.push({ value: '', label: '—' })
    for (let n = min; n <= max; n += step) {
      list.push({ value: String(n), label: `${n}${suffix}` })
    }
    return list
  }, [min, max, step, suffix, allowEmpty])

  const displayValue = value === '' && allowEmpty ? '' : value

  return (
    <div className="w-[72px] rounded-lg border border-white/10 bg-black/30 p-1.5">
      <WheelColumn
        options={options}
        value={displayValue}
        onChange={onChange}
        aria-label="value"
      />
    </div>
  )
}
