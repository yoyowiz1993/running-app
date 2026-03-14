import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CloudOff, Cloud, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { subscribe, getSyncSnapshot } from '../lib/syncStatus'
import { retryCloudSync } from '../lib/storage'

function SyncIndicator() {
  const [status, lastError] = useSyncExternalStore(subscribe, getSyncSnapshot, getSyncSnapshot)
  const showIndicator = status !== 'idle'
  if (!showIndicator) return null

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-white/50 text-xs" aria-label="Syncing">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Syncing…</span>
      </div>
    )
  }
  if (status === 'synced') {
    return (
      <div className="flex items-center gap-1.5 text-emerald-400/80 text-xs" aria-label="Synced">
        <Cloud className="h-3.5 w-3.5" />
        <span>Synced</span>
      </div>
    )
  }
  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 text-amber-400/80 text-xs" aria-label="Offline">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Offline</span>
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={() => void retryCloudSync()}
        className="flex items-center gap-1.5 text-red-400/80 hover:text-red-300 text-xs transition"
        aria-label={`Sync failed: ${lastError ?? 'unknown'}. Tap to retry.`}
        title={lastError ?? 'Sync failed. Tap to retry.'}
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span>Sync failed</span>
        <RefreshCw className="h-3 w-3" />
      </button>
    )
  }
  return null
}

export function TopBar({
  title,
  left,
  right,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="safe-area-pt safe-area-px sticky top-0 z-20 bg-[#070b14]/75 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {left ?? <span className="text-lg font-semibold text-white">{title}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SyncIndicator />
          {right}
        </div>
      </div>
      <div className="h-px w-full bg-white/10" />
    </div>
  )
}

