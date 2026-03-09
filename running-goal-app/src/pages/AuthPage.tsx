import { Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input, Label } from '../components/Field'
import { signIn, signUp } from '../lib/auth'

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
      setNotice('Check your email for confirmation if required, then sign in.')
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <div className="safe-area-px safe-area-pt mx-auto w-full max-w-md px-4 pb-8 pt-10">
        <Card className="p-5">
          <div className="text-xl font-semibold text-white">Welcome to Running Plan</div>
          <div className="mt-1 text-sm text-white/70">Sign in to sync your plan across devices.</div>

          <div className="mt-5 grid gap-3">
            <div>
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-white/70" /> Email
                </span>
              </Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-white/70" /> Password
                </span>
              </Label>
              <Input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {notice}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button
              variant={mode === 'signin' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMode('signin')}
              disabled={loading}
            >
              Sign In
            </Button>
            <Button
              variant={mode === 'signup' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMode('signup')}
              disabled={loading}
            >
              Sign Up
            </Button>
          </div>

          <div className="mt-3">
            <Button className="w-full" onClick={() => void submit()} disabled={loading || !email || !password}>
              {loading ? 'Please wait...' : mode === 'signin' ? 'Continue' : 'Create account'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

