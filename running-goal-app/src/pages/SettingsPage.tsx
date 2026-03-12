import { motion } from 'framer-motion'
import { Link2, LogOut, Shield, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'
import { signOut } from '../lib/auth'
import { clearAllData, loadActivePlan, loadPlans } from '../lib/storage'
import { computeStreak } from '../lib/stats'
import { getApiBase, getGarminAuthUrl } from '../lib/garmin'
import { FEATURES } from '../lib/featureFlags'
import { getStravaAuthUrl, fetchStravaConnectionStatus, saveStravaTokens } from '../lib/strava'
import { supabase } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function Avatar({ user }: { user: SupabaseUser | null }) {
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const name = (user?.user_metadata?.full_name ?? user?.email ?? '') as string
  const initials = name
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
      />
    )
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-emerald-500 text-2xl font-bold text-white ring-2 ring-white/10">
      {initials || <User className="h-8 w-8" />}
    </div>
  )
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export function SettingsPage() {
  const nav = useNavigate()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [cleared, setCleared] = useState(false)
  const [garminStatus, setGarminStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [stravaStatus, setStravaStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [stravaAthleteName, setStravaAthleteName] = useState<string>('')
  const [backendUrl, setBackendUrl] = useState<string>('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    void supabase?.auth.getUser().then(({ data }) => {
      const u = data.user ?? null
      setUser(u)
      if (u?.id) {
        void fetchStravaConnectionStatus(u.id).then(({ connected, athleteName }) => {
          setStravaStatus(connected ? 'connected' : 'disconnected')
          if (athleteName) setStravaAthleteName(athleteName)
        })
      }
    })
    const flag = localStorage.getItem('runningPlan.garmin.connected')
    setGarminStatus(flag === 'true' ? 'connected' : 'disconnected')
    getApiBase().then(setBackendUrl)
  }, [])

  useEffect(() => {
    const hash = window.location.hash || ''
    const q = hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search
    const params = new URLSearchParams(q)
    const garmin = params.get('garmin')
    const strava = params.get('strava')
    if (garmin === 'connected') {
      localStorage.setItem('runningPlan.garmin.connected', 'true')
      setGarminStatus('connected')
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    } else if (garmin === 'error') {
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
    if (strava === 'connected') {
      // Parse tokens that the backend encoded into the redirect URL
      const at = params.get('at')
      const rt = params.get('rt')
      const ea = params.get('ea')
      const aid = params.get('aid')
      const an = params.get('an') ?? ''
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
      if (at && rt && ea) {
        void supabase?.auth.getUser().then(({ data }) => {
          const uid = data.user?.id
          if (!uid) return
          void saveStravaTokens(uid, {
            accessToken: at,
            refreshToken: rt,
            expiresAt: Number(ea),
            athleteId: Number(aid ?? 0),
            athleteName: an,
          }).then(() => {
            setStravaStatus('connected')
            setStravaAthleteName(an)
          })
        })
      }
    } else if (strava === 'error') {
      window.history.replaceState(null, '', window.location.pathname + '#/settings')
    }
  }, [])

  const plan = loadActivePlan()
  const plans = loadPlans()
  const streak = plan ? computeStreak(plan.workouts) : 0
  const completedWorkouts = plan?.workouts.filter((w) => Boolean(w.completedAtISO) && w.type !== 'rest').length ?? 0

  const displayName = (user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Runner') as string
  const email = user?.email ?? ''
  const provider = user?.app_metadata?.provider as string | undefined
  const providerLabel = provider === 'google' ? 'Google account' : provider === 'email' ? 'Email account' : null

  function clear(): void {
    clearAllData()
    setCleared(true)
    setTimeout(() => nav('/'), 300)
  }

  async function handleSignOut(): Promise<void> {
    setSigningOut(true)
    await signOut()
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar title="Account" />
      <motion.div
        className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >

        {/* ── Profile card ── */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent p-5">
              <div className="flex items-center gap-4">
                <Avatar user={user} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-bold text-white">{displayName}</div>
                  {email ? (
                    <div className="mt-0.5 truncate text-sm text-white/50">{email}</div>
                  ) : null}
                  {providerLabel ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/50">
                      <Shield className="h-3 w-3" />
                      {providerLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Quick stats */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Plans', value: plans.length },
                  { label: 'Workouts', value: completedWorkouts },
                  { label: 'Streak', value: `${streak}d` },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/8 bg-black/20 py-2.5 text-center"
                  >
                    <div className="text-xl font-bold text-white">{s.value}</div>
                    <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Sign out ── */}
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
              Session
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </Card>
        </motion.div>

        {/* ── Garmin (hidden when disabled) ── */}
        {FEATURES.garmin ? (
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
              Garmin Connect
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    garminStatus === 'connected' ? 'bg-emerald-400' : 'bg-white/20'
                  }`}
                />
                <span className={`text-sm ${garminStatus === 'connected' ? 'text-emerald-300' : 'text-white/50'}`}>
                  {garminStatus === 'connected' ? 'Connected' : garminStatus === 'unknown' ? 'Checking…' : 'Not connected'}
                </span>
              </div>
              <Button
                variant="secondary"
                onClick={() => { void getGarminAuthUrl().then((url) => { window.location.href = url }) }}
              >
                <Link2 className="h-4 w-4" />
                {garminStatus === 'connected' ? 'Reconnect' : 'Connect'}
              </Button>
            </div>
            {backendUrl && !backendUrl.startsWith('http://localhost') ? (
              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-1.5 text-xs font-mono text-white/40 truncate">
                {backendUrl}
              </div>
            ) : backendUrl.startsWith('http://localhost') ? (
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Backend is running locally. Set VITE_API_BASE_URL to your deployed Render URL.
              </div>
            ) : null}
          </Card>
        </motion.div>
        ) : null}

        {/* ── Strava (hidden when disabled) ── */}
        {FEATURES.strava ? (
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
              Strava
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    stravaStatus === 'connected' ? 'bg-orange-400' : 'bg-white/20'
                  }`}
                />
                <div>
                  <span className={`text-sm ${stravaStatus === 'connected' ? 'text-orange-300' : 'text-white/50'}`}>
                    {stravaStatus === 'connected'
                      ? stravaAthleteName
                        ? `Connected as ${stravaAthleteName}`
                        : 'Connected'
                      : stravaStatus === 'unknown'
                        ? 'Checking…'
                        : 'Not connected'}
                  </span>
                  {stravaStatus !== 'connected' && (
                    <p className="text-[11px] text-white/30 mt-0.5">Sync your runs automatically</p>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!user?.id) return
                  void getStravaAuthUrl(user.id).then((url) => { window.location.href = url })
                }}
              >
                <Link2 className="h-4 w-4" />
                {stravaStatus === 'connected' ? 'Reconnect' : 'Connect'}
              </Button>
            </div>
          </Card>
        </motion.div>
        ) : null}

        {/* ── Danger zone ── */}
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400/70 mb-3">
              Danger Zone
            </div>
            <div className="text-sm text-white/50 mb-3">
              Permanently delete all local data including your plans and goals. This cannot be undone.
            </div>
            <Button variant="danger" className="w-full" onClick={clear}>
              <Trash2 className="h-4 w-4" /> Clear all data
            </Button>
            {cleared ? (
              <div className="mt-3 text-sm text-emerald-300">Data cleared.</div>
            ) : null}
          </Card>
        </motion.div>

      </motion.div>
    </div>
  )
}
