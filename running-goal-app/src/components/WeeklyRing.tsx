import { motion } from 'framer-motion'

type RingProps = {
  cx: number
  cy: number
  r: number
  color: string
  pct: number
  delay?: number
}

function Ring({ cx, cy, r, color, pct, delay = 0 }: RingProps) {
  const circ = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, pct))
  const dash = clamped * circ

  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="9"
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${dash} ${circ}` }}
        transition={{ duration: 1.1, ease: 'easeOut', delay }}
      />
    </>
  )
}

type Props = {
  moveValue: number
  moveMax: number
  distanceValue: number
  distanceMax: number
  streakValue: number
  streakMax?: number
}

export function WeeklyRing({
  moveValue,
  moveMax,
  distanceValue,
  distanceMax,
  streakValue,
  streakMax = 7,
}: Props) {
  const size = 156
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.2))' }}
      >
        <Ring cx={cx} cy={cy} r={62} color="#10b981" pct={moveValue / Math.max(1, moveMax)} delay={0.1} />
        <Ring cx={cx} cy={cy} r={49} color="#38bdf8" pct={distanceValue / Math.max(1, distanceMax)} delay={0.25} />
        <Ring cx={cx} cy={cy} r={36} color="#8b5cf6" pct={streakValue / Math.max(1, streakMax)} delay={0.4} />
      </svg>

      {/* Labels — unrotated via counter-rotate */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rotate-0 text-center">
          <div className="text-lg font-bold tabular-nums text-white leading-tight">{moveValue}</div>
          <div className="text-[9px] font-medium uppercase tracking-wider text-white/40">workouts</div>
        </div>
      </div>
    </div>
  )
}

type LegendItemProps = { color: string; label: string; value: string }

export function WeeklyRingLegend({ items }: { items: LegendItemProps[] }) {
  return (
    <div className="flex flex-col justify-center gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
          <div className="text-xs text-white/50">{item.label}</div>
          <div className="text-xs font-semibold text-white ml-auto">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
