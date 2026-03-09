import { Link2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { signOut } from '../lib/auth'
import { clearAllData } from '../lib/storage'
import { getApiBase, getGarminAuthUrl } from '../lib/garmin'

export function SettingsPage() {
  const nav = useNavigate()
  const [cleared, setCleared] = useState(false)
  const [garminStatus, setGarminStatus] = useState<'unknown' | 'connected' | 'disconnected'>(
    'unknown',
  )
  const [backendUrl, setBackendUrl] = useState<string>('')

  useEffect(() => {
    const flag = localStorage.getItem('runningPlan.garmin.connected')
    setGarminStatus(flag === 'true' ? 'connected' : 'disconnected')
  }, [])

  // Handle redirect back from Garmin OAuth callback
  useEffect(() => {
    const hash = window.location.hash || ''
    const q = hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search
    const params = new URLSearchParams(q)
    const garmin = params.get('garmin')
    if (garmin === 'connected') {
      localStorage.setItem('runningPlan.garmin.connected', 'true')
      setGarminStatus('connected')
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    } else if (garmin === 'error') {
      const message = params.get('message') || 'Unknown error'
      console.warn('Garmin OAuth error:', message)
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
  }, [])

  useEffect(() => {
    getApiBase().then(setBackendUrl)
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
          <div className="text-base font-semibold text-white">Data & Account</div>
          <div className="mt-1 text-sm text-white/70">
            Your goal + plan are synced to your account (and also cached on this device).
          </div>
          <div className="mt-4">
            <Button variant="danger" className="w-full" onClick={clear}>
              <Trash2 className="h-4 w-4" /> Clear all data
            </Button>
          </div>
          <div className="mt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                void signOut()
              }}
            >
              Sign out
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
                getGarminAuthUrl().then((url) => {
                  window.location.href = url
                })
              }}
            >
              <Link2 className="h-4 w-4" /> Connect Garmin
            </Button>
          </div>
          {backendUrl ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
              Backend: <span className="font-mono text-white/80">{backendUrl}</span>
              {backendUrl.startsWith('http://localhost') ? (
                <div className="mt-1 text-amber-200/90">
                  Set VITE_API_BASE_URL on Netlify to your Render URL, or add apiBaseUrl in
                  public/config.json, then redeploy.
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

