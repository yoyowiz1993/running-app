import { motion } from 'framer-motion'
import { Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Field'
import { signIn, signInWithGoogle, signUp } from '../lib/auth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

const FEATURES = [
  { label: 'AI Training Plans', color: 'bg-violet-400' },
  { label: 'Smart Nutrition', color: 'bg-emerald-400' },
  { label: 'Streak Tracking', color: 'bg-amber-400' },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay } },
})

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(): Promise<void> {
    setError(null)
    setNotice(null)
    setLoading(true)
    const fn = mode === 'signin' ? signIn : signUp
    const msg = await fn(email.trim(), password)
    setLoading(false)
    if (msg) {
      setError(msg)
      return
    }
    if (mode === 'signup') {
      setNotice('Check your email for a confirmation link, then sign in.')
    }
  }

  async function submitGoogle(): Promise<void> {
    setError(null)
    setNotice(null)
    setLoading(true)
    const msg = await signInWithGoogle()
    setLoading(false)
    if (msg) setError(msg)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b14]">
      {/* Background orbs */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)', filter: 'blur(48px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #059669, transparent 70%)', filter: 'blur(48px)' }}
      />

      <div className="safe-area-px safe-area-pt relative mx-auto flex w-full max-w-md flex-col px-4 pb-12 pt-14">

        {/* ── Hero ── */}
        <motion.div {...fadeUp(0)} className="mb-10 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-emerald-500 text-3xl shadow-[0_12px_48px_rgba(139,92,246,0.4)]">
            🏃
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">RunPace</h1>
          <p className="mt-2 text-base text-white/60">Train smarter. Run faster.</p>

          {/* Feature pills */}
          <motion.div {...fadeUp(0.15)} className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70"
              >
                <div className={`h-1.5 w-1.5 rounded-full ${f.color}`} />
                {f.label}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── Auth card ── */}
        <motion.div {...fadeUp(0.25)}>
          <Card className="p-5">

            {/* Google — primary CTA */}
            <button
              type="button"
              onClick={() => void submitGoogle()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-medium text-white/30">or continue with email</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Mode pill toggle */}
            <div className="mb-4 flex items-center justify-center">
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(null); setNotice(null) }}
                    disabled={loading}
                    className={`rounded-lg px-5 py-1.5 text-sm font-medium transition ${
                      mode === m
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {m === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>
            </div>

            {/* Email + password */}
            <div className="grid gap-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="pl-9"
                  onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="pl-9"
                  onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                />
              </div>
            </div>

            {/* Feedback */}
            {error ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {notice}
              </div>
            ) : null}

            {/* Submit */}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={() => void submit()}
              disabled={loading || !email || !password}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.4)} className="mt-6 text-center text-xs text-white/25">
          Your data is encrypted and synced across devices.
        </motion.div>
      </div>
    </div>
  )
}
