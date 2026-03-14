export type ToastType = 'error' | 'success' | 'info'

export type Toast = {
  id: string
  message: string
  type: ToastType
  createdAt: number
}

const toasts: Toast[] = []
const listeners: Array<() => void> = []
let cachedSnapshot: Toast[] = []
let notifyScheduled = false

function notify(): void {
  cachedSnapshot = [...toasts]
  if (notifyScheduled) return
  notifyScheduled = true
  setTimeout(() => {
    notifyScheduled = false
    listeners.forEach((l) => l())
  }, 0)
}

export function getToasts(): Toast[] {
  // useSyncExternalStore requires a STABLE reference when data hasn't changed.
  // Returning a new array every time causes "Maximum update depth exceeded".
  // notify() updates cachedSnapshot when toasts actually change.
  return cachedSnapshot
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    const i = listeners.indexOf(listener)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  toasts.push({ id, message, type, createdAt: Date.now() })
  if (toasts.length > 5) toasts.shift()
  notify()
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx >= 0) {
      toasts.splice(idx, 1)
      notify()
    }
  }, 5000)
}

export function dismissToast(id: string): void {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx >= 0) {
    toasts.splice(idx, 1)
    notify()
  }
}
