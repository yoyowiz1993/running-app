import { Link2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { clearAllData } from '../lib/storage'
import { getGarminAuthUrl } from '../lib/garmin'

export function SettingsPage() {
  const nav = useNavigate()
  const [cleared, setCleared] = useState(false)
  const [garminStatus, setGarminStatus] = useState<'unknown' | 'connected' | 'disconnected'>(
    'unknown',
  )

  useEffect(() => {
    // For now we just read a flag from localStorage; later this can query the backend.
    const flag = localStorage.getItem('runningPlan.garmin.connected')
    setGarminStatus(flag === 'true' ? 'connected' : 'disconnected')
  }, [])

  function clear(): void {
    clearAllData()
    setCleared(true)
    setTimeout(() => nav('/'), 250)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Settings" />
      <div className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5">
        <Card className="p-4">
          <div className="text-base font-semibold text-white">Data</div>
          <div className="mt-1 text-sm text-white/70">
            Your goal + plan are stored on this device only (offline).
          </div>
          <div className="mt-4">
            <Button variant="danger" className="w-full" onClick={clear}>
              <Trash2 className="h-4 w-4" /> Clear all data
            </Button>
          </div>
          {cleared ? <div className="mt-3 text-sm text-emerald-200">Cleared.</div> : null}
        </Card>

        <Card className="mt-4 p-4">
          <div className="text-base font-semibold text-white">Garmin</div>
          <div className="mt-1 text-sm text-white/70">
            Connect your Garmin account so runs can sync into this app (backend + Garmin keys
            required).
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Status:{' '}
              <span
                className={
                  garminStatus === 'connected'
                    ? 'text-emerald-300'
                    : garminStatus === 'unknown'
                      ? 'text-white/60'
                      : 'text-white/50'
                }
              >
                {garminStatus === 'connected'
                  ? 'Connected'
                  : garminStatus === 'unknown'
                    ? 'Checking...'
                    : 'Not connected'}
              </span>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = getGarminAuthUrl()
              }}
            >
              <Link2 className="h-4 w-4" /> Connect Garmin
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

