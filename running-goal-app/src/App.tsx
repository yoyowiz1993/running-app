import { AnimatePresence, motion } from 'framer-motion'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState, startTransition } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BottomNav } from './components/BottomNav'
import { Toast } from './components/Toast'
import { CalendarPage } from './pages/CalendarPage'
import { HomePage } from './pages/HomePage'
import { NutritionPage } from './pages/NutritionPage'
import { PlanPage } from './pages/PlanPage'
import { RacesPage } from './pages/RacesPage'
import { HistoryPage } from './pages/HistoryPage'
import { AboutPage } from './pages/AboutPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { AuthPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { getSession, onAuthChange } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { clearAllData, hydrateLocalFromCloud, loadOnboardingComplete, loadPlans, setCloudUserId } from './lib/storage'

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
            <Route path="/races" element={<RacesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/about" element={<AboutPage />} />
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const handleOnboardingComplete = useCallback(() => setOnboardingDismissed(true), [])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const s = await getSession()
        if (!mounted) return
        if (s?.user.id) {
          setCloudUserId(s.user.id)
          await hydrateLocalFromCloud(s.user.id)
        } else {
          setCloudUserId(null)
        }
        setSession(s)
      } catch (e) {
        console.error('Auth init error:', e)
        if (mounted) setSession(null)
      } finally {
        if (mounted) setChecking(false)
      }
    })()

    const unsub = onAuthChange((event, s) => {
      // Use startTransition to avoid "Maximum update depth" when Supabase fires multiple events rapidly
      startTransition(() => {
        if (!mounted) return
        setSession(s)
        if (s?.user.id) {
          setCloudUserId(s.user.id)
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            void hydrateLocalFromCloud(s.user.id)
          }
        } else {
          setCloudUserId(null)
          clearAllData() // Clear so switching accounts doesn't show previous user's data
        }
      })
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
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center gap-5 px-6">
        <div className="h-12 w-12 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        <span className="text-base font-medium text-white/80">Loading RunPace…</span>
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  const plans = loadPlans()
  const onboardingComplete = loadOnboardingComplete()
  const showOnboarding = plans.length === 0 && !onboardingComplete && !onboardingDismissed

  return (
    <HashRouter>
      {showOnboarding ? (
        <Routes>
          <Route path="*" element={<OnboardingPage onComplete={handleOnboardingComplete} />} />
        </Routes>
      ) : (
        <>
          <Shell />
          <Toast />
        </>
      )}
    </HashRouter>
  )
}
