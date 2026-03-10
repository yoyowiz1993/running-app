import { cn } from '../lib/cn'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-sm font-medium text-white/90">{children}</div>
}

export function Help({ children }: { children: ReactNode }) {
  return <div className="text-xs text-white/60">{children}</div>
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      className={cn(
        'mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/10',
        className,
      )}
      {...rest}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props
  return (
    <select
      className={cn(
        'mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-emerald-400/50 focus:ring-4 focus:ring-emerald-400/10',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

