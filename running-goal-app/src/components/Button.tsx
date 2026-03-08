import { cn } from '../lib/cn'
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = size === 'lg' ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-violet-600 to-emerald-500 text-white shadow-[0_12px_40px_rgba(34,197,94,0.15)] hover:brightness-110'
      : variant === 'secondary'
        ? 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
        : variant === 'danger'
          ? 'bg-red-500/15 text-red-100 hover:bg-red-500/25 border border-red-500/30'
          : 'bg-transparent text-white/90 hover:bg-white/10'

  return <button className={cn(base, sizes, styles, className)} {...props} />
}

