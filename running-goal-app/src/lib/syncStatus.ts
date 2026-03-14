export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline'

type State = {
  status: SyncStatus
  lastError: string | null
}

let state: State = { status: 'idle', lastError: null }
let cachedSnapshot: [SyncStatus, string | null] = ['idle', null]
const listeners: Array<() => void> = []
let notifyScheduled = false

function notify(): void {
  if (notifyScheduled) return
  notifyScheduled = true
  setTimeout(() => {
    notifyScheduled = false
    listeners.forEach((l) => l())
  }, 0)
}

export function getSyncStatus(): SyncStatus {
  return state.status
}

export function getSyncLastError(): string | null {
  return state.lastError
}

/** Single snapshot for useSyncExternalStore - stable reference until store changes */
export function getSyncSnapshot(): [SyncStatus, string | null] {
  return cachedSnapshot
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    const i = listeners.indexOf(listener)
    if (i >= 0) listeners.splice(i, 1)
  }
}

export function setSyncStatus(status: SyncStatus, error?: string): void {
  state = {
    status,
    lastError: error ?? (status === 'failed' ? state.lastError : null),
  }
  cachedSnapshot = [state.status, state.lastError]
  notify()
}
