import { AnimatePresence, motion } from 'framer-motion'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BottomNav } from './components/BottomNav'
import { CalendarPage } from './pages/CalendarPage'
import { HomePage } from './pages/HomePage'
import { NutritionPage } from './pages/NutritionPage'
import { PlanPage } from './pages/PlanPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { AuthPage } from './pages/AuthPage'
import { getSession, onAuthChange } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { hydrateLocalFromCloud, setCloudUserId } from './lib/storage'

function Shell() {
  const loc = useLocation()
  const hideNav = loc.pathname.startsWith('/workout/')

  return (
    <div className="min-h-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="min-h-full"
        >
          <Routes location={loc}>
            <Route path="/" element={<HomePage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/nutrition" element={<NutritionPage />} />
            <Route path="/workout/:id" element={<WorkoutPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      {hideNav ? null : <BottomNav />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const s = await getSession()
      if (!mounted) return
      if (s?.user.id) {
        setCloudUserId(s.user.id)
        await hydrateLocalFromCloud(s.user.id)
      } else {
        setCloudUserId(null)
      }
      setSession(s)
      setChecking(false)
    })()

    const unsub = onAuthChange((_event, s) => {
      setSession(s)
      if (s?.user.id) {
        setCloudUserId(s.user.id)
        void hydrateLocalFromCloud(s.user.id)
      } else {
        setCloudUserId(null)
      }
    })
    return () => {
      mounted = false
      unsub()
    }
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#070b14] p-5 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-lg font-semibold">Supabase not configured</div>
          <div className="mt-2 text-sm text-white/70">
            Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your frontend environment.
          </div>
        </div>
      </div>
    )
  }

  if (checking) {
    return <div className="min-h-screen bg-[#070b14]" />
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
