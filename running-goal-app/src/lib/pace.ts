export function parsePaceToSecPerKm(input: string): number | null {
  const raw = input.trim().toLowerCase().replace('/km', '').replace('per km', '').trim()
  if (!raw) return null

  const m = raw.match(/^(\d{1,2})\s*:\s*([0-5]\d)$/)
  if (m) {
    const min = Number(m[1])
    const sec = Number(m[2])
    const total = min * 60 + sec
    return total > 0 ? total : null
  }

  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 60)
}

export function formatPace(secPerKm: number): string {
  const s = Math.max(1, Math.round(secPerKm))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}/km`
}

export function clampPace(secPerKm: number): number {
  return Math.min(Math.max(secPerKm, 120), 720)
}

