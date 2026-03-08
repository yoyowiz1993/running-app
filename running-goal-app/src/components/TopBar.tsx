import type { ReactNode } from 'react'

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="safe-area-pt safe-area-px sticky top-0 z-20 bg-[#070b14]/75 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="text-lg font-semibold text-white">{title}</div>
        <div>{right}</div>
      </div>
      <div className="h-px w-full bg-white/10" />
    </div>
  )
}

