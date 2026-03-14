export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline'

type State = {
  status: SyncStatus
  lastError: string | null
}

let state: State = { status: 'idle', lastError: null }
const listeners: Array<() => void> = []

function notify(): void {
  listeners.forEach((l) => l())
}

export function getSyncStatus(): SyncStatus {
  return state.status
}

export function getSyncLastError(): string | null {
  return state.lastError
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
  notify()
}
