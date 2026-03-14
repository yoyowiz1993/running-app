import { useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { getToasts, subscribe, dismissToast, type Toast as ToastItem } from '../lib/toast'

function ToastItemUI({ t }: { t: ToastItem }) {
  const Icon = t.type === 'error' ? AlertCircle : t.type === 'success' ? CheckCircle2 : Info
  const bg =
    t.type === 'error'
      ? 'bg-red-500/20 border-red-400/40 text-red-200'
      : t.type === 'success'
        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
        : 'bg-white/10 border-white/20 text-white/80'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${bg}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm font-medium">{t.message}</span>
      <button
        type="button"
        onClick={() => dismissToast(t.id)}
        className="shrink-0 rounded p-1 hover:bg-white/10 transition"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

export function Toast() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts)
  if (toasts.length === 0) return null
  return (
    <div className="fixed left-0 right-0 top-20 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 px-4 safe-area-px">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItemUI key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}
