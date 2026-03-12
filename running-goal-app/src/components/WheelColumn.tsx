import { useLayoutEffect, useRef } from 'react'

export const ROW_HEIGHT = 32
const VISIBLE_ROWS = 3
export const COLUMN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS
const PADDING = ROW_HEIGHT * 2 // so first/last item can scroll to center

export type WheelOption = { value: string; label: string }

type WheelColumnProps = {
  options: WheelOption[]
  value: string
  onChange: (value: string) => void
  'aria-label'?: string
}

export function WheelColumn({ options, value, onChange, 'aria-label': ariaLabel }: WheelColumnProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const index =
    value === ''
      ? 0
      : Math.min(
          Math.max(0, options.findIndex((o) => o.value === value)),
          options.length - 1
        )
  const safeIndex = index < 0 ? 0 : index

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    const targetScroll = safeIndex * ROW_HEIGHT
    if (Math.abs(el.scrollTop - targetScroll) > 1) {
      el.scrollTop = targetScroll
    }
  }, [safeIndex])

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleScroll = () => {
    const el = elRef.current
    if (!el) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      const i = Math.round(el.scrollTop / ROW_HEIGHT)
      const clamped = Math.max(0, Math.min(i, options.length - 1))
      const v = options[clamped]?.value ?? options[0]!.value
      onChange(v)
    }, 80)
  }

  return (
    <div className="relative flex-1 min-w-0">
      <div
        ref={elRef}
        role="listbox"
        aria-label={ariaLabel}
        className="w-full overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth py-0"
        style={{
          height: COLUMN_HEIGHT,
          scrollSnapType: 'y mandatory',
          scrollPadding: `${PADDING}px 0`,
        }}
        onScroll={handleScroll}
      >
        <div style={{ height: PADDING, flexShrink: 0 }} aria-hidden />
        {options.map((opt) => (
          <div
            key={opt.value}
            role="option"
            aria-selected={opt.value === value}
            style={{
              height: ROW_HEIGHT,
              scrollSnapAlign: 'center',
              scrollSnapStop: 'always',
            }}
            className="flex items-center justify-center text-white/90 text-lg font-medium select-none"
          >
            {opt.label}
          </div>
        ))}
        <div style={{ height: PADDING, flexShrink: 0 }} aria-hidden />
      </div>
      <div
        className="pointer-events-none absolute left-0 right-0 border-y border-emerald-400/40 bg-emerald-500/10"
        style={{
          top: (COLUMN_HEIGHT - ROW_HEIGHT) / 2,
          height: ROW_HEIGHT,
        }}
      />
    </div>
  )
}
