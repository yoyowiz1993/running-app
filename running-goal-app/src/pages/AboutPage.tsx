import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { TopBar } from '../components/TopBar'

const APP_VERSION = '1.0.0'
const GITHUB_URL = 'https://github.com/yoyowiz1993/running-app'

export function AboutPage() {
  const nav = useNavigate()

  return (
    <div className="min-h-full bg-gradient-to-b from-[#070b14] via-[#070b14] to-[#041a14]">
      <TopBar
        title="About"
        left={
          <button
            type="button"
            onClick={() => nav(-1)}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        }
      />
      <motion.div
        className="safe-area-px mx-auto w-full max-w-md px-4 pb-28 pt-5 space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent p-6 text-center">
            <div className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
              RunPace
            </div>
            <div className="mt-2 text-sm text-white/50">Running Plan</div>
            <div className="mt-1 text-xs text-white/40">Version {APP_VERSION}</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-white/40 mt-0.5" />
            <div className="text-sm text-white/70 leading-relaxed">
              <p>
                Train smarter. Run faster. Build AI-powered training plans, track nutrition,
                and stay motivated with streak tracking and workout reminders.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">
            Open source
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10 transition"
          >
            <span>View on GitHub</span>
            <ExternalLink className="h-4 w-4 text-white/50" />
          </a>
        </Card>
      </motion.div>
    </div>
  )
}
